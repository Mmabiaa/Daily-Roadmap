import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'

import { route, ApiError } from '@/lib/api'
import { normalizeEmail } from '@/lib/auth'
import { ensureIndexes, getDb } from '@/lib/mongodb'
import { AccountUpdateSchema } from '@/lib/models'

const DUPLICATE_KEY = 11000

/**
 * The account's identity, as opposed to its profile: the username it signs in
 * with, the email PIN resets go to, and the zone its wall-clock times belong
 * to. Kept apart from `/api/profile` because these live on the `users` document
 * rather than the `profiles` one — and because the username, unlike everything
 * in the profile, is not editable.
 */

type AccountView = { username: string; email: string; timezone: string }

/** The account behind the session, or a 404 if it vanished mid-session. */
async function readAccount(userId: string): Promise<AccountView> {
  const db = await getDb()
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) })
  if (!user) throw new ApiError(404, 'Account not found')

  return {
    username: String(user.username ?? ''),
    email: String(user.email ?? ''),
    timezone: String(user.timezone ?? 'UTC'),
  }
}

export const GET = route({ failure: 'Failed to load your account' }, async ({ user }) =>
  NextResponse.json(await readAccount(user.id))
)

export const PATCH = route(
  {
    body: AccountUpdateSchema,
    invalidBody: 'Check your details and try again',
    failure: 'Failed to save your account',
  },
  async ({ user, body }) => {
    await ensureIndexes()
    const db = await getDb()
    const _id = new ObjectId(user.id)

    const set: Record<string, unknown> = { updatedAt: new Date() }

    if (body.email !== undefined) {
      const email = normalizeEmail(body.email)
      // Pre-check for a friendly message; the unique index is the real guard.
      const taken = await db.collection('users').findOne({ email, _id: { $ne: _id } })
      if (taken) throw new ApiError(409, 'That email is already registered')
      set.email = email
    }
    if (body.timezone !== undefined) set.timezone = body.timezone

    try {
      await db.collection('users').updateOne({ _id }, { $set: set })
    } catch (error: unknown) {
      if ((error as { code?: number })?.code === DUPLICATE_KEY) {
        throw new ApiError(409, 'That email is already registered')
      }
      throw error
    }

    return NextResponse.json(await readAccount(user.id))
  }
)
