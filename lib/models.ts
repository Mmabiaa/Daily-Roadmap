import { z } from 'zod'
import { newPinProblem } from './pin.ts'
import { isDate, TIME_PATTERN } from './schedule-time.ts'

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
/** A real calendar date: the pattern alone would accept 2026-02-30. */
const DateString = z.string().refine(isDate, 'Use a real YYYY-MM-DD date')

/** Either a set of weekdays, or one fixed calendar date. */
export const RepeatSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('weekly'),
    // A repeated weekday would resolve the same block twice on that day.
    days: z
      .array(DayNameSchema)
      .min(1)
      .refine((listed) => new Set(listed).size === listed.length, 'List each weekday once'),
  }),
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

/**
 * Fields a client may set on a new event, or replace when editing one.
 * `exceptions` is deliberately absent: those are written by the server when a
 * `scope: 'this'` edit or a one-day skip names a date, so a client can neither
 * forge one nor drop the ones already stored.
 */
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
})

/**
 * Rules about the event as a whole rather than a single field. Create and edit
 * both run these, so a block of no length, a window that ends before it starts
 * or a one-off carrying a window is refused at the door rather than stored.
 */
function eventIssues(
  value: { start: string; end: string; repeat: Repeat; startDate?: string; endDate?: string },
  ctx: z.RefinementCtx
) {
  if (value.end === value.start) {
    ctx.addIssue({
      code: 'custom',
      path: ['end'],
      message: 'End time must differ from the start time',
    })
  }

  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'End date must not be before the start date',
    })
  }

  // A one-off is dated by its own `repeat.date`; a window would only disagree.
  if (value.repeat.type === 'once' && (value.startDate ?? value.endDate)) {
    ctx.addIssue({
      code: 'custom',
      path: [value.startDate ? 'startDate' : 'endDate'],
      message: 'A one-off event takes no start or end date',
    })
  }
}

export const EventInputSchema = EventFields.superRefine(eventIssues)
export type EventInput = z.infer<typeof EventInputSchema>

/**
 * `scope` says how much of a repeating event an edit or delete covers:
 * `this` writes an exception for `date`; `future` splits the series there.
 */
export const EventUpdateSchema = EventFields.extend({
  scope: z.enum(['this', 'future']).default('future'),
  date: DateString.optional(),
}).superRefine(eventIssues)
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

// ─── Phase 2 profile, onboarding and sharing ────────────────────────────────
// One document per account holds the choices that shape its day: when it wakes
// and sleeps, what kind of day it is, the clock the screens read, its own
// guardrails, and whether onboarding has been finished. Kept out of `users` so
// the account stays only what sign-in needs.

/** What kind of day the account is built around. */
export const PERSONAS = ['student', 'worker', 'freelancer', 'shift'] as const
export const PersonaSchema = z.enum(PERSONAS)
export type Persona = z.infer<typeof PersonaSchema>

/** The clock the screens read: 12- or 24-hour. */
export const CLOCKS = ['12', '24'] as const
export const ClockSchema = z.enum(CLOCKS)
export type Clock = z.infer<typeof ClockSchema>

/** Whether to nudge before a block, and how many minutes ahead. */
export const ReminderSchema = z.object({
  enabled: z.boolean(),
  lead: z.number().int().min(0).max(120),
})
export type Reminder = z.infer<typeof ReminderSchema>

/** The account's own guardrails, shown on the Guide screen and edited there. */
export const RulesSchema = z.object({
  phone: z.array(z.string().trim().min(1).max(200)).max(12),
  study: z.array(z.string().trim().min(1).max(200)).max(12),
})
export type Rules = z.infer<typeof RulesSchema>

export const ProfileSchema = z.object({
  userId: z.string(),
  /** False until the onboarding flow is finished; a missing profile means done. */
  onboarded: z.boolean(),
  wake: TimeString,
  sleep: TimeString,
  persona: PersonaSchema,
  goals: z.array(z.string().trim().min(1).max(60)).max(8),
  clock: ClockSchema,
  reminders: ReminderSchema,
  rules: RulesSchema,
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})
export type Profile = z.infer<typeof ProfileSchema>

/**
 * What the Settings screen may change. `onboarded` is deliberately absent: only
 * the onboarding route sets it, the same way exceptions are server-managed.
 */
export const ProfileUpdateSchema = z
  .object({
    wake: TimeString.optional(),
    sleep: TimeString.optional(),
    persona: PersonaSchema.optional(),
    goals: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
    clock: ClockSchema.optional(),
    reminders: ReminderSchema.optional(),
    rules: RulesSchema.optional(),
  })
  .refine((value) => !(value.wake && value.sleep && value.wake === value.sleep), {
    path: ['sleep'],
    message: 'Wake and sleep must differ',
  })
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>

/**
 * The must-dos offered at the end of onboarding. Whichever three to five are
 * picked become the account's Minimum day, so the keys map to the blocks a
 * drafted plan marks essential.
 */
export const MUST_DOS = ['wake', 'study', 'move', 'project', 'winddown', 'sleep'] as const
export const MustDoSchema = z.enum(MUST_DOS)
export type MustDo = z.infer<typeof MustDoSchema>

/**
 * The last step of onboarding: the answers, plus the must-dos. The server turns
 * these into the account's first week and marks it onboarded.
 */
export const OnboardingSchema = z.object({
  wake: TimeString,
  sleep: TimeString,
  persona: PersonaSchema,
  goals: z.array(z.string().trim().min(1).max(60)).max(8),
  essentials: z.array(MustDoSchema).min(3).max(5),
})
export type OnboardingInput = z.infer<typeof OnboardingSchema>

/**
 * A timetable paste. The text is parsed on the server into fixed class events;
 * `replace` clears the account's existing classes first, so re-importing a
 * corrected timetable does not leave the old one behind.
 */
export const TimetableSchema = z.object({
  text: z.string().trim().min(1).max(20000),
  replace: z.boolean().optional(),
})
export type TimetableInput = z.infer<typeof TimetableSchema>

/** A class timetable shared by code: anyone signed in may import a snapshot. */
export const ShareCreateSchema = z.object({
  label: z.string().trim().max(80).optional(),
})
export type ShareCreateInput = z.infer<typeof ShareCreateSchema>

export const ShareImportSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, 'Enter the 6-character code'),
})
export type ShareImportInput = z.infer<typeof ShareImportSchema>
