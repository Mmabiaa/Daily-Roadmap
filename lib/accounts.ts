import { ObjectId } from 'mongodb'

import { getDb } from './mongodb.ts'
import { tokenVersionOf, type SessionPayload } from './session.ts'

/**
 * The signed-in account behind a request.
 *
 * Deliberately just the id: routes read their own fields from the collections
 * they own, so this stays the one thing every route needs.
 */
export type Account = { id: string }

/**
 * The account a session payload belongs to, or `null`.
 *
 * The signature alone is not enough: a token stays cryptographically valid for
 * a week, so this also checks that the account still exists and that its token
 * version has not moved on. Without that, a deleted account — or one whose PIN
 * was just changed to shut a thief out — would keep working until the token
 * expired on its own.
 *
 * Kept out of `lib/api.ts`, which imports Next.js, so the retirement rule can
 * be integration-tested against a real database. `requireUser()` is exactly
 * this plus a 401 when it answers `null`.
 */
export async function accountFor(session: SessionPayload | null): Promise<Account | null> {
  if (!session || !ObjectId.isValid(session.userId)) return null

  const db = await getDb()
  const user = await db.collection('users').findOne({ _id: new ObjectId(session.userId) })
  if (!user || tokenVersionOf(user) !== session.tv) return null

  return { id: session.userId }
}
