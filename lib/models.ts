import { z } from 'zod'
import { newPinProblem } from './pin'

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

/** Usernames are short and URL-safe; reset codes are always six digits. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/
export const OTP_PATTERN = /^\d{6}$/

/**
 * A PIN chosen from now on: 6–8 digits and not trivially guessable.
 * Sign-in has no equivalent check, so accounts with older 4–8 digit PINs keep
 * working — see `lib/pin.ts`.
 */
const NewPinSchema = z.string().superRefine((value, ctx) => {
  const problem = newPinProblem(value)
  if (problem) ctx.addIssue({ code: 'custom', message: problem })
})

export const SignUpSchema = z.object({
  username: z.string().trim().regex(USERNAME_PATTERN, 'Use 3–32 letters, numbers, dot, dash or underscore'),
  email: z.email('Enter a valid email address'),
  pin: NewPinSchema,
})

export type SignUpInput = z.infer<typeof SignUpSchema>

/** `identifier` is either the username or the email on the account. */
export const ForgotPinSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your username or email'),
})

export const ResetPinSchema = z.object({
  identifier: z.string().trim().min(1),
  otp: z.string().regex(OTP_PATTERN, 'Enter the 6-digit code'),
  pin: NewPinSchema,
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
