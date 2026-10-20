import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'

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

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string }
  } catch {
    return null
  }
}

export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  
  if (!token) return null
  
  return verifyToken(token)
}

export async function setSession(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('auth-token')
}
