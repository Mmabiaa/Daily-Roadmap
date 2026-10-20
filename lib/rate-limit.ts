import { getDb } from './mongodb'
import { FAILURE_WINDOW_MS, lockDurationMs, RateLimitScope } from './rate-limit-policy'

/**
 * Sign-in throttling buckets, one document per account or IP.
 *
 * `_id` is the bucket key itself, which makes every update an upsert on a
 * single document — two wrong PINs arriving at the same moment cannot lose
 * each other's increment.
 */
const COLLECTION = 'rate_limits'

type Bucket = {
  _id: string
  failures: number
  windowStartedAt: Date
  lockedUntil?: Date
  expiresAt: Date
}

/** The instant a bucket is free again, or `null` when it is not locked. */
export async function lockedUntil(key: string): Promise<Date | null> {
  const db = await getDb()
  const bucket = await db.collection<Bucket>(COLLECTION).findOne({ _id: key })
  if (!bucket?.lockedUntil) return null
  const until = new Date(bucket.lockedUntil)
  return until > new Date() ? until : null
}

/**
 * Counts one failed attempt and returns the lock it produced, or `null` while
 * the bucket is still below the threshold.
 *
 * The window restart and the increment happen in one aggregation-pipeline
 * update, so concurrent failures cannot double-count or reset each other.
 */
export async function recordFailure(key: string, scope: RateLimitScope): Promise<Date | null> {
  const db = await getDb()
  const now = new Date()
  const windowFloor = new Date(now.getTime() - FAILURE_WINDOW_MS)
  const expired = { $lt: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowFloor] }

  const updated = await db.collection<Bucket>(COLLECTION).findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          failures: {
            $cond: [expired, 1, { $add: [{ $ifNull: ['$failures', 0] }, 1] }],
          },
          windowStartedAt: {
            $cond: [expired, now, { $ifNull: ['$windowStartedAt', now] }],
          },
        },
      },
      // Cleanup deadline; a lock pushes it later below.
      { $set: { expiresAt: { $add: ['$windowStartedAt', FAILURE_WINDOW_MS] } } },
    ],
    { upsert: true, returnDocument: 'after' }
  )

  const lockMs = lockDurationMs(updated?.failures ?? 1, scope)
  if (lockMs === 0) return null

  const until = new Date(now.getTime() + lockMs)
  await db.collection<Bucket>(COLLECTION).updateOne(
    { _id: key },
    { $set: { lockedUntil: until, expiresAt: new Date(until.getTime() + FAILURE_WINDOW_MS) } }
  )
  return until
}

/** Forgets a bucket completely — used once the right PIN has been supplied. */
export async function clearFailures(key: string): Promise<void> {
  const db = await getDb()
  await db.collection<Bucket>(COLLECTION).deleteOne({ _id: key })
}
