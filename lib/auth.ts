import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { cookies } from 'next/headers'

import { SessionPayload, verifyToken } from './session'

/** Name of the session cookie. Defined once so every route agrees. */
export const SESSION_COOKIE = 'auth-token'

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

/**
 * The only place session cookie attributes are decided, so pages and API routes
 * cannot drift apart. httpOnly keeps the token away from JavaScript; `lax`
 * still sends it on top-level navigations, which is what the app needs.
 */
function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  }
}

/** The raw cookie value on the current request, if there is one. */
export async function sessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value ?? null
}

/** Verifies the session cookie. Says nothing about whether the account still exists. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = await sessionToken()
  return token ? verifyToken(token) : null
}

export async function setSession(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions())
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

let dummyHash: Promise<string> | null = null

/**
 * A real bcrypt hash of a value no PIN can be, computed once per process.
 *
 * Sign-in compares against it when the username is unknown, so that path costs
 * the same as a wrong PIN and response timing cannot be used to work out which
 * usernames are registered.
 */
export function dummyPinHash(): Promise<string> {
  if (!dummyHash) dummyHash = bcrypt.hash('no-such-pin', 10)
  return dummyHash
}

/** A 6-digit one-time code drawn from a CSPRNG (never Math.random). */
export function generateOtp(digits = 6): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, '0')
}

/** Emails are matched case-insensitively, so always store this form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** PIN-reset policy, shared by the request and verify endpoints. */
export const OTP_TTL_MINUTES = 10
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_SECONDS = 60
