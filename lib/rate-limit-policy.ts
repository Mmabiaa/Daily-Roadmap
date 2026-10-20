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

/** Failures allowed inside the window before any lock starts. */
export const MAX_FAILURES = 5

/** 1m → 5m → 15m → 1h, then doubling for anything beyond that. */
export const LOCK_STEPS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000]

/**
 * Hard ceilings per scope. An account is never locked for more than an hour:
 * anyone can mistype a PIN five times, and a day-long lock would let an
 * attacker keep a victim out of their own account.
 */
export const SCOPE_CAP_MS: Record<RateLimitScope, number> = {
  account: 60 * 60 * 1000,
  ip: 24 * 60 * 60 * 1000,
}

/** How long a lock lasts once `failures` have piled up. 0 means "not locked". */
export function lockDurationMs(failures: number, scope: RateLimitScope): number {
  if (failures < MAX_FAILURES) return 0
  const step = failures - MAX_FAILURES
  const last = LOCK_STEPS_MS.length - 1
  const raw = step <= last ? LOCK_STEPS_MS[step] : LOCK_STEPS_MS[last] * 2 ** (step - last)
  return Math.min(raw, SCOPE_CAP_MS[scope])
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
