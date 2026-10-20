import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import {
  hashPin,
  normalizeEmail,
  OTP_MAX_ATTEMPTS,
  setSession,
  verifyPin,
} from '@/lib/auth'
import { generateToken, tokenVersionOf } from '@/lib/session'
import { ResetPinSchema } from '@/lib/models'
import { accountKey } from '@/lib/rate-limit-policy'
import { clearFailures } from '@/lib/rate-limit'

const COLLECTION = 'pin_resets'

/** One message for every failure, so a wrong code and an unknown account are indistinguishable. */
const invalidCode = { error: 'That code is invalid or has expired.' }

/** Confirms the emailed code and sets the new PIN, then signs the user in. */
export async function POST(request: Request) {
  try {
    const parsed = ResetPinSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check the code and try again' },
        { status: 400 }
      )
    }

    const { identifier, otp, pin } = parsed.data
    const db = await getDb()

    const user = await db
      .collection('users')
      .findOne({ $or: [{ username: identifier }, { email: normalizeEmail(identifier) }] })
    if (!user) return NextResponse.json(invalidCode, { status: 400 })

    const userId = user._id.toString()
    const reset = await db.collection(COLLECTION).findOne({ userId })

    if (!reset || reset.expiresAt <= new Date()) return NextResponse.json(invalidCode, { status: 400 })

    if (reset.attempts >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Request a new code.' },
        { status: 429 }
      )
    }

    if (!(await verifyPin(otp, reset.codeHash))) {
      await db.collection(COLLECTION).updateOne({ userId }, { $inc: { attempts: 1 } })
      return NextResponse.json(invalidCode, { status: 400 })
    }

    // Changing the PIN retires every session that was already handed out, so a
    // thief holding an old token loses it the moment the owner resets the PIN.
    // The increment and the new hash land in one atomic update.
    const updated = await db.collection('users').findOneAndUpdate(
      { _id: user._id },
      {
        $set: { pinHash: await hashPin(pin), updatedAt: new Date() },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' }
    )

    // The code is single-use: clearing it also resets the attempt counter.
    await db.collection(COLLECTION).deleteOne({ userId })

    // Proving the emailed code is stronger than a PIN attempt, and this route is
    // never blocked by the sign-in lock, so clear any lock the account collected.
    // Otherwise a reset PIN would still be unusable until the lock expired.
    await clearFailures(accountKey(user.username))

    // Signed in on the version we just created, so this device works while
    // every other one is signed out.
    await setSession(generateToken(userId, tokenVersionOf(updated)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset PIN error:', error)
    return NextResponse.json({ error: 'Could not reset the PIN. Please try again.' }, { status: 500 })
  }
}
