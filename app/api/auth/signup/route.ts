import { NextResponse } from 'next/server'
import { ensureIndexes, getDb } from '@/lib/mongodb'
import { generateToken, hashPin, normalizeEmail, setSession } from '@/lib/auth'
import { SignUpSchema } from '@/lib/models'

const DUPLICATE_KEY = 11000

/**
 * Creates an account and signs it straight in.
 *
 * Uniqueness is enforced by the database (unique indexes on `users.username`
 * and `users.email`), so two simultaneous sign-ups with the same details can
 * never both succeed — the loser gets MongoDB's duplicate-key error and 409.
 */
export async function POST(request: Request) {
  try {
    const parsed = SignUpSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check your details and try again' },
        { status: 400 }
      )
    }

    const username = parsed.data.username
    const email = normalizeEmail(parsed.data.email)

    await ensureIndexes()
    const db = await getDb()

    // Pre-check purely for a specific, friendly message; the index is the real guard.
    const existing = await db.collection('users').findOne({ $or: [{ username }, { email }] })
    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.username === username
              ? 'That username is already taken'
              : 'That email is already registered',
        },
        { status: 409 }
      )
    }

    const result = await db.collection('users').insertOne({
      username,
      email,
      pinHash: await hashPin(parsed.data.pin),
      createdAt: new Date(),
    })

    await setSession(generateToken(result.insertedId.toString()))

    return NextResponse.json({ success: true, username }, { status: 201 })
  } catch (error: any) {
    if (error?.code === DUPLICATE_KEY) {
      return NextResponse.json(
        { error: 'That username or email is already registered' },
        { status: 409 }
      )
    }
    console.error('Sign up error:', error)
    return NextResponse.json({ error: 'Sign up failed' }, { status: 500 })
  }
}
