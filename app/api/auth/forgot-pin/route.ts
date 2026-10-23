import { NextResponse } from 'next/server'
import { ensureIndexes, getDb } from '@/lib/mongodb'
import {
  generateOtp,
  hashPin,
  normalizeEmail,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
} from '@/lib/auth'
import { ForgotPinSchema } from '@/lib/models'
import { isMailConfigured, sendPinResetCode } from '@/lib/mailer'

const COLLECTION = 'pin_resets'

/**
 * Identical reply whether or not the account exists, so this endpoint cannot be
 * used to work out which usernames or emails are registered.
 */
const genericReply = {
  success: true,
  message: 'If that account exists, a reset code is on its way.',
  expiresInMinutes: OTP_TTL_MINUTES,
}

/** Requests a 6-digit reset code by email. */
export async function POST(request: Request) {
  try {
    const parsed = ForgotPinSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Enter your username or email' },
        { status: 400 }
      )
    }

    if (!isMailConfigured()) {
      return NextResponse.json(
        { error: 'Email is not configured on the server, so reset codes cannot be sent.' },
        { status: 503 }
      )
    }

    const identifier = parsed.data.identifier
    await ensureIndexes()
    const db = await getDb()

    const user = await db
      .collection('users')
      .findOne({ $or: [{ username: identifier }, { email: normalizeEmail(identifier) }] })

    // No account, or an account without an email on file: stay silent.
    if (!user || !user.email) return NextResponse.json(genericReply)

    const userId = user._id.toString()
    const now = new Date()

    const current = await db.collection(COLLECTION).findOne({ userId })
    if (current) {
      const since = now.getTime() - new Date(current.createdAt).getTime()
      // Still cooling down: the code from the previous request is valid, so
      // reply exactly as if a new one had been sent. Answering differently here
      // would reveal which accounts exist.
      if (current.expiresAt > now && since < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        return NextResponse.json(genericReply)
      }
    }

    const code = generateOtp()

    // One active code per account, replaced atomically on each request.
    await db.collection(COLLECTION).updateOne(
      { userId },
      {
        $set: {
          userId,
          codeHash: await hashPin(code),
          expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000),
          attempts: 0,
          createdAt: now,
        },
      },
      { upsert: true }
    )

    try {
      await sendPinResetCode(user.email, code, OTP_TTL_MINUTES)
    } catch (error) {
      console.error('Reset code email failed:', error)
      // Don't leave a code the user never received lying around.
      await db.collection(COLLECTION).deleteOne({ userId })
      return NextResponse.json(
        { error: 'We could not send the reset code. Please try again shortly.' },
        { status: 502 }
      )
    }

    return NextResponse.json(genericReply)
  } catch (error) {
    console.error('Forgot PIN error:', error)
    return NextResponse.json({ error: 'Could not start the reset. Please try again.' }, { status: 500 })
  }
}
