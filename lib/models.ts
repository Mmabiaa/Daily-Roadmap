import { z } from 'zod'
import { newPinProblem } from './pin'
import { DATE_PATTERN, TIME_PATTERN } from './schedule-time'

/**
 * The pre-1A event shape: a weekday plus a start time, with no stored end.
 * Still written by nothing new, but read (and normalised) until 1B — see
 * `normalizeLegacyEvent` in `lib/resolver.ts`. Delete with it.
 */
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

// ─── Phase 1A schedule model ────────────────────────────────────────────────
// The v2 event stores an explicit `start` and `end`, how it repeats, and the
// date window it applies to, so a block no longer borrows its end from the
// next block's start. Completions move out of `progress` into their own
// collection keyed by event id, which is what fixes an edit orphaning a tick.

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const DayNameSchema = z.enum(DAY_NAMES)
export type DayName = z.infer<typeof DayNameSchema>

export const CATEGORY_NAMES = [
  'class', 'study', 'project', 'body', 'eat', 'people', 'rest', 'chores', 'sleep',
] as const
export const CategoryNameSchema = z.enum(CATEGORY_NAMES)
export type CategoryName = z.infer<typeof CategoryNameSchema>

/**
 * `fixed` is a class or any other appointment that happens at a set time;
 * `flexible` is anything the owner moves around. Only two fixed events can
 * conflict — a flexible block may sit on top of anything.
 */
export const KINDS = ['fixed', 'flexible'] as const
export const KindSchema = z.enum(KINDS)
export type Kind = z.infer<typeof KindSchema>

const TimeString = z.string().regex(TIME_PATTERN, 'Use a 24-hour HH:MM time')
const DateString = z.string().regex(DATE_PATTERN, 'Use a YYYY-MM-DD date')

/** Either a set of weekdays, or one fixed calendar date. */
export const RepeatSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('weekly'), days: z.array(DayNameSchema).min(1) }),
  z.object({ type: z.literal('once'), date: DateString }),
])
export type Repeat = z.infer<typeof RepeatSchema>

/**
 * A change to a repeating event on one date. `skip` hides it that day; the
 * remaining fields replace what the event itself says, for that date only.
 * This is how scope `this` edits are stored, so the series is untouched.
 */
export const ExceptionSchema = z.object({
  date: DateString,
  skip: z.boolean().optional(),
  start: TimeString.optional(),
  end: TimeString.optional(),
  title: z.string().min(1).optional(),
  note: z.string().optional(),
  essential: z.boolean().optional(),
})
export type EventException = z.infer<typeof ExceptionSchema>

/** Where an event came from, so migrated rows can be told from authored ones. */
export const SOURCES = ['user', 'seed', 'migration'] as const
export const SourceSchema = z.enum(SOURCES)
export type Source = z.infer<typeof SourceSchema>

/** An event as stored. `ownerId` is always set by the server, never the client. */
export const EventDocSchema = z.object({
  _id: z.string().optional(),
  ownerId: z.string(),
  title: z.string().min(1),
  category: CategoryNameSchema,
  kind: KindSchema,
  start: TimeString,
  end: TimeString,
  repeat: RepeatSchema,
  startDate: DateString.optional(),
  endDate: DateString.optional(),
  essential: z.boolean(),
  exceptions: z.array(ExceptionSchema),
  source: SourceSchema,
  note: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})
export type EventDoc = z.infer<typeof EventDocSchema>

/** Fields a client may set on a new event, or replace when editing one. */
const EventFields = z.object({
  title: z.string().trim().min(1).max(120),
  category: CategoryNameSchema,
  kind: KindSchema,
  start: TimeString,
  end: TimeString,
  repeat: RepeatSchema,
  startDate: DateString.optional(),
  endDate: DateString.optional(),
  note: z.string().max(500).optional(),
  essential: z.boolean().optional(),
  exceptions: z.array(ExceptionSchema).optional(),
})

/**
 * A new or edited event must have a real length. Zero-length blocks only exist
 * in migrated data (two legacy blocks sharing a start time); they cannot be
 * created or kept through this API.
 */
const endsDiffer = (value: { start: string; end: string }) => value.end !== value.start
const endsDifferIssue = {
  message: 'End time must differ from the start time',
  path: ['end'],
}

export const EventInputSchema = EventFields.refine(endsDiffer, endsDifferIssue)
export type EventInput = z.infer<typeof EventInputSchema>

/**
 * `scope` says how much of a repeating event an edit or delete covers:
 * `this` writes an exception for `date`; `future` splits the series there.
 */
export const EventUpdateSchema = EventFields.extend({
  scope: z.enum(['this', 'future']).default('future'),
  date: DateString.optional(),
}).refine(endsDiffer, endsDifferIssue)
export type EventUpdate = z.infer<typeof EventUpdateSchema>

/**
 * One ticked block: an event that occurred on a date, in the owner's zone.
 * The unique index on `(ownerId, date, eventId)` is what lets `done: false`
 * simply delete the row, and stops a double tap creating two.
 */
export const CompletionSchema = z.object({
  ownerId: z.string(),
  date: DateString,
  eventId: z.string(),
  doneAt: z.date(),
})
export type Completion = z.infer<typeof CompletionSchema>

/**
 * Body of `PATCH /api/completions`: tick a block on a date, or clear it. The
 * row is keyed by the event id, so moving the event's time later does not
 * orphan the tick the way the old position-keyed key did.
 */
export const CompletionToggleSchema = z.object({
  date: DateString,
  eventId: z.string().min(1),
  done: z.boolean(),
})
export type CompletionToggle = z.infer<typeof CompletionToggleSchema>

/** Accounts are identified by a unique username and (once set) a unique email. */
export const UserSchema = z.object({
  _id: z.string().optional(),
  username: z.string().min(1),
  email: z.string().optional(),
  pinHash: z.string(),
  /** IANA zone the account's wall-clock times belong to; older accounts have none. */
  timezone: z.string().optional(),
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
  /** The browser's zone, so the account's wall-clock times mean its own time. */
  timezone: z.string().optional(),
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
