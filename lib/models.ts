import { z } from 'zod'

export const EventSchema = z.object({
  _id: z.string().optional(),
  day: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  time: z.string(),
  title: z.string().min(1),
  category: z.enum(['class', 'study', 'project', 'body', 'eat', 'people', 'rest', 'chores', 'sleep']),
  note: z.string().optional(),
  essential: z.boolean().optional(),
})

export type Event = z.infer<typeof EventSchema>

/** Accounts are identified by a unique username and (once set) a unique email. */
export const UserSchema = z.object({
  _id: z.string().optional(),
  username: z.string().min(1),
  email: z.string().optional(),
  pinHash: z.string(),
})

export type User = z.infer<typeof UserSchema>

/** A PIN is 4–8 digits; usernames are short and URL-safe. */
export const PIN_PATTERN = /^\d{4,8}$/
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/
export const OTP_PATTERN = /^\d{6}$/

export const SignUpSchema = z.object({
  username: z.string().trim().regex(USERNAME_PATTERN, 'Use 3–32 letters, numbers, dot, dash or underscore'),
  email: z.email('Enter a valid email address'),
  pin: z.string().regex(PIN_PATTERN, 'PIN must be 4–8 digits'),
})

export type SignUpInput = z.infer<typeof SignUpSchema>

/** `identifier` is either the username or the email on the account. */
export const ForgotPinSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your username or email'),
})

export const ResetPinSchema = z.object({
  identifier: z.string().trim().min(1),
  otp: z.string().regex(OTP_PATTERN, 'Enter the 6-digit code'),
  pin: z.string().regex(PIN_PATTERN, 'PIN must be 4–8 digits'),
})

/** A single block's completion state, keyed by `keyFor(date, day, time)`. */
export const ChecksSchema = z.record(z.string(), z.boolean())
/** Weekly review answers, keyed by ISO date (YYYY-MM-DD). */
export const ReviewsSchema = z.record(z.string(), z.array(z.string()))
/** Daily energy level, keyed by ISO date (YYYY-MM-DD). */
export const EnergySchema = z.record(z.string(), z.enum(['low', 'okay', 'high']))

/**
 * Everything a signed-in user persists for the app. Stored one document per
 * user in the `progress` collection so nothing lives in the browser.
 */
export const ProgressSchema = z.object({
  checks: ChecksSchema.optional(),
  reviews: ReviewsSchema.optional(),
  energy: EnergySchema.optional(),
  theme: z.enum(['light', 'dark']).optional(),
})

export type Progress = z.infer<typeof ProgressSchema>
export type Checks = z.infer<typeof ChecksSchema>
export type Reviews = z.infer<typeof ReviewsSchema>
export type Energy = z.infer<typeof EnergySchema>
