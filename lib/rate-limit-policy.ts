import { createHash } from 'node:crypto'

/**
 * Sign-in throttling policy.
 *
 * Pure rules only — no database and no environment lookups — so the behaviour
 * can be unit-tested directly. `lib/rate-limit.ts` applies them to MongoDB.
 */

export type RateLimitScope = 'account' | 'ip'

/** Failures inside this window count towards a lock. */
export const FAILURE_WINDOW_MS = 15 * 60 * 1000

/** Account: failures allowed inside the window before the first lock. */
export const MAX_FAILURES = 5

/** Account ladder: 1m → 5m → 15m → 1h, then doubling (capped below). */
export const LOCK_STEPS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000]

/**
 * IP: failed attempts across *all* accounts from one address before that
 * address locks. Far higher than the account threshold on purpose — a campus,
 * office or phone network shares a single address, and a few residents
 * mistyping their PIN must not lock the whole building out.
 */
export const MAX_IP_FAILURES = 30

/**
 * Hard ceilings per scope. Nothing is ever locked for more than an hour: a
 * day-long lock would let an attacker keep a victim, or a whole campus, out of
 * their own accounts long after the guessing stopped.
 */
export const SCOPE_CAP_MS: Record<RateLimitScope, number> = {
  account: 60 * 60 * 1000,
  ip: 60 * 60 * 1000,
}

/**
 * How long a lock lasts once `failures` have piled up. 0 means "not locked".
 *
 * The account scope climbs a ladder so a genuine mistype is a short wait. The
 * IP scope is not a person, so it has no ladder: it is either under the (much
 * higher) threshold or locked for the full cap.
 */
export function lockDurationMs(failures: number, scope: RateLimitScope): number {
  if (scope === 'ip') {
    return failures < MAX_IP_FAILURES ? 0 : SCOPE_CAP_MS.ip
  }
  if (failures < MAX_FAILURES) return 0
  const step = failures - MAX_FAILURES
  const last = LOCK_STEPS_MS.length - 1
  const raw = step <= last ? LOCK_STEPS_MS[step] : LOCK_STEPS_MS[last] * 2 ** (step - last)
  return Math.min(raw, SCOPE_CAP_MS.account)
}

/** True when the counting window has gone stale, so the count restarts at 1. */
export function isWindowExpired(windowStartedAt: Date | null | undefined, now: Date): boolean {
  if (!windowStartedAt) return true
  return now.getTime() - windowStartedAt.getTime() >= FAILURE_WINDOW_MS
}

/**
 * Bucket key for an attempted username. Case-folded so that guessing `Alice`
 * cannot sidestep the lock collected against `alice`.
 */
export function accountKey(username: string): string {
  return `acct:${username.trim().toLowerCase()}`
}

/** Bucket key for a client IP. Hashed, so raw addresses are never stored. */
export function ipKey(ip: string): string {
  return `ip:${createHash('sha256').update(ip).digest('hex')}`
}

/** Seconds for a `Retry-After` header; never 0, so a client cannot retry at once. */
export function retryAfterSeconds(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000))
}
