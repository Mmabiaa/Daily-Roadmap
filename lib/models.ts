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

export const UserSchema = z.object({
  _id: z.string().optional(),
  username: z.string().min(1),
  pinHash: z.string(),
})

export type User = z.infer<typeof UserSchema>

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
