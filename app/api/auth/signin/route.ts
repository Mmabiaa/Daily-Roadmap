import { NextResponse } from 'next/server'
import { ensureIndexes, getDb } from '@/lib/mongodb'
import { dummyPinHash, setSession, verifyPin } from '@/lib/auth'
import { generateToken, tokenVersionOf } from '@/lib/session'
import { clientIpFrom } from '@/lib/client-ip'
import { accountKey, ipKey, retryAfterSeconds } from '@/lib/rate-limit-policy'
import { clearFailures, lockedUntil, recordFailure } from '@/lib/rate-limit'

/** Identical for a wrong PIN and an unknown username, so neither can be probed. */
const INVALID_CREDENTIALS = { error: 'Invalid credentials' }
const TOO_MANY_ATTEMPTS = { error: 'Too many attempts. Please try again later.' }

function lockedResponse(until: Date) {
  return NextResponse.json(TOO_MANY_ATTEMPTS, {
    status: 429,
    headers: { 'Retry-After': String(retryAfterSeconds(until, new Date())) },
  })
}

export async function POST(request: Request) {
  try {
    const { username, pin } = await request.json()

    if (!username || !pin) {
      return NextResponse.json(
        { error: 'Username and PIN are required' },
        { status: 400 }
      )
    }

    const attempted = accountKey(String(username))
    const ip = clientIpFrom(request)
    const byIp = ip ? ipKey(ip) : null

    // A locked account or IP is refused before any work happens.
    for (const bucket of byIp ? [attempted, byIp] : [attempted]) {
      const until = await lockedUntil(bucket)
      if (until) return lockedResponse(until)
    }

    // Also creates the throttle buckets' TTL index, once per process.
    await ensureIndexes()
    const db = await getDb()
    const user = await db.collection('users').findOne({ username })

    // An unknown username still pays for a bcrypt compare, so the reply takes
    // the same time as a wrong PIN and cannot reveal whether the account exists.
    const isValid = await verifyPin(String(pin), user?.pinHash ?? (await dummyPinHash()))

    if (!user || !isValid) {
      const lockedByIp = byIp ? await recordFailure(byIp, 'ip') : null
      const lockedByAccount = await recordFailure(attempted, 'account')
      const until = lockedByAccount ?? lockedByIp
      return until ? lockedResponse(until) : NextResponse.json(INVALID_CREDENTIALS, { status: 401 })
    }

    // A correct PIN clears this account's failures. The IP counter is left to
    // decay on its own: someone holding one valid account must not be able to
    // reset the IP bucket and carry on spraying other accounts.
    await clearFailures(attempted)

    // The token carries the account's current version, so a token minted before
    // the last PIN change (or "sign out everywhere") is refused on later requests.
    await setSession(generateToken(user._id.toString(), tokenVersionOf(user)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sign in error:', error)
    return NextResponse.json(
      { error: 'Sign in failed' },
      { status: 500 }
    )
  }
}
