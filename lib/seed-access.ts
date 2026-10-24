import { timingSafeEqual } from 'node:crypto'

export type SeedAccessResult = 'ok' | 'disabled' | 'forbidden'

/**
 * Decides whether a `/api/seed` request may run.
 *
 * Seeding creates the first account, so it must not be callable by strangers.
 * The caller presents `SEED_SECRET` in the `x-seed-key` header; when no secret
 * is configured the endpoint is switched off in production (it has no business
 * being open there) but stays available in development so `npm run dev` can
 * seed without extra setup.
 *
 * Kept as a pure function so the rule can be unit-tested without a database.
 */
export function checkSeedAccess(input: {
  providedKey: string | null
  configuredSecret?: string
  isProduction: boolean
}): SeedAccessResult {
  const { providedKey, configuredSecret, isProduction } = input

  if (!configuredSecret) return isProduction ? 'disabled' : 'ok'
  if (!providedKey) return 'forbidden'

  return timingSafeEqualString(providedKey, configuredSecret) ? 'ok' : 'forbidden'
}

/**
 * Reads the key a request presents.
 *
 * Query strings are written to access logs, proxies and browser history, so
 * `?key=` is only honoured outside production (handy with `npm run dev`).
 */
export function providedSeedKey(request: Request): string | null {
  const header = request.headers.get('x-seed-key')
  if (header) return header

  if (process.env.NODE_ENV !== 'production') {
    return new URL(request.url).searchParams.get('key')
  }

  return null
}

/** Constant-time comparison, so a wrong key cannot be guessed byte by byte. */
function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
