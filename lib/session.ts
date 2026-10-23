import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'

/**
 * Session tokens, kept separate from cookie handling so the signing rules can
 * be unit-tested without a Next.js request context.
 */

export type SessionPayload = {
  /** `_id` of the account, as a string. */
  userId: string
  /**
   * The account's token version when this token was issued. A token whose `tv`
   * no longer matches the account is refused, which is how changing the PIN or
   * "sign out everywhere" kills sessions that were already handed out.
   */
  tv: number
}

export const SESSION_TTL = '7d'

/**
 * Fail fast rather than fall back.
 *
 * A built-in default secret would let anyone mint a valid session, and a
 * random one that changes per process would sign every user out on restart —
 * so a production deploy without `JWT_SECRET` must not start at all.
 */
export function assertSessionSecret(env: Record<string, string | undefined>): void {
  if (env.JWT_SECRET) return

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be set in production (generate one with `openssl rand -hex 32`).'
    )
  }

  console.warn(
    '⚠ JWT_SECRET is not set: this process will sign sessions with a random secret, ' +
      'so every session is invalidated when the server restarts.'
  )
}

// Evaluated on import, so a misconfigured production deploy dies at startup
// rather than on the first sign-in.
assertSessionSecret(process.env)

let cachedSecret: string | null = null

/** The process-wide signing secret, created once for development. */
function jwtSecret(): string {
  if (!cachedSecret) {
    cachedSecret = process.env.JWT_SECRET || randomBytes(32).toString('hex')
  }
  return cachedSecret
}

export function generateToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ userId, tv: tokenVersion }, jwtSecret(), { expiresIn: SESSION_TTL })
}

/**
 * Reads a token back, or returns `null` if it is missing, forged or expired.
 *
 * A token minted before token versions existed carries no `tv` and counts as
 * version 0, so shipping this feature does not sign everybody out.
 */
export function verifyToken(token: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret())
    if (typeof payload === 'string') return null
    const { userId, tv } = payload as { userId?: unknown; tv?: unknown }
    if (typeof userId !== 'string') return null
    return { userId, tv: typeof tv === 'number' ? tv : 0 }
  } catch {
    return null
  }
}

/**
 * The token version of an account document; accounts older than this feature
 * count as 0. Takes `unknown` because the driver hands back a loosely typed
 * document and the only thing worth trusting is a numeric field.
 */
export function tokenVersionOf(user: unknown): number {
  if (!user || typeof user !== 'object') return 0
  const { tokenVersion } = user as { tokenVersion?: unknown }
  return typeof tokenVersion === 'number' ? tokenVersion : 0
}
