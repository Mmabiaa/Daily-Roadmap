/**
 * Wall-clock time helpers for the schedule.
 *
 * A schedule time is `"HH:MM"` on the user's own clock, never a UTC instant,
 * so a 06:30 class stays at 06:30 across a daylight-saving change (see
 * `lib/timezone.ts`). Everything here is pure, so it can be tested directly.
 */

import { days, type Day } from './schedule.ts'

/** 24-hour `HH:MM`. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** `YYYY-MM-DD`. */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Where the last block of a day ended before events had an explicit end: the
 * app always drew the final block as running until the next morning's wake.
 * Kept as a named constant because the migration has to reproduce it exactly.
 */
export const LAST_WAKE = '05:30'

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

/**
 * True only for a real calendar date in `YYYY-MM-DD` form.
 *
 * The pattern alone accepts `2026-02-30` and `2026-13-01`, which are not dates.
 * So the parse has to round-trip: `Date.UTC` rolls an impossible month or day
 * into the next one, and only a date that survives unchanged is real.
 */
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  // `Date.UTC` folds a year below 100 into the 1900s, so put the year back
  // before comparing — otherwise `0026-01-01` would be read as 1926.
  parsed.setUTCFullYear(year)

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

/**
 * The weekday a `YYYY-MM-DD` date falls on.
 *
 * A calendar date's weekday is the same everywhere, so this is deliberately
 * zone-free: the caller has already worked out which date it is on the user's
 * clock (`todayIn`), and re-deriving it here would only invite the two to
 * disagree near midnight.
 */
export function weekdayOf(date: string): Day {
  const [year, month, day] = date.split('-').map(Number)
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = Sunday
  return days[(jsDay + 6) % 7]
}

/** A `Date` back to a `YYYY-MM-DD` date, read in UTC. */
export function isoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/** `date` moved by `days` (negative goes back). Pure calendar arithmetic. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return isoDate(new Date(Date.UTC(year, month - 1, day + days)))
}

/** The day before `date` — the split point when a series is truncated. */
export function dayBefore(date: string): string {
  return addDays(date, -1)
}

/** The Monday of the week `date` falls in. */
export function weekStartOf(date: string): string {
  return addDays(date, -days.indexOf(weekdayOf(date)))
}

/** Minutes after local midnight. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Minutes after midnight back to `"HH:MM"`, wrapping around a 24-hour day. */
export function timeOf(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  const hours = Math.floor(wrapped / 60)
  return `${String(hours).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

/**
 * The end a block had before ends were stored: the *next* block's start, or
 * `LAST_WAKE` for the last block of the day. A block that would end before it
 * starts runs on into the next morning — that is how the app has always read
 * a 22:00 "lights out" (as ending at 05:30).
 */
export function legacyEnd(start: string, nextStart?: string | null): string {
  const from = minutesOf(start)
  const raw = minutesOf(nextStart || LAST_WAKE)
  return timeOf(raw <= from ? raw + 1440 : raw)
}

/**
 * A block's length. `end === start` is a zero-length block (legacy rows that
 * shared a start time with their neighbour); otherwise an end at or before the
 * start means it finishes the next morning.
 */
export function durationMinutes(start: string, end: string): number {
  if (end === start) return 0
  const from = minutesOf(start)
  const to = minutesOf(end)
  return (to < from ? to + 1440 : to) - from
}

/** [start, end) in minutes, with an end at or before the start pushed a day on. */
function spanOf(start: string, end: string): { from: number; to: number } {
  const from = minutesOf(start)
  if (end === start) return { from, to: from }
  const to = minutesOf(end)
  return { from, to: to < from ? to + 1440 : to }
}

/**
 * True when two blocks on the same day share any time.
 *
 * Both ends are treated as half-open, so 09:00–10:00 and 10:00–11:00 sit
 * back to back without conflicting. Each interval is also compared one day
 * later, because a block that runs past midnight really does meet the next
 * morning's early blocks.
 */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a = spanOf(aStart, aEnd)
  const b = spanOf(bStart, bEnd)
  // A zero-length block occupies no time, so it can never conflict.
  if (a.to <= a.from || b.to <= b.from) return false

  for (const shiftA of [0, 1440]) {
    for (const shiftB of [0, 1440]) {
      if (a.from + shiftA < b.to + shiftB && b.from + shiftB < a.to + shiftA) return true
    }
  }
  return false
}
