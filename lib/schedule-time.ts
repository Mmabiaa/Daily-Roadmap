/**
 * Wall-clock time helpers for the schedule.
 *
 * A schedule time is `"HH:MM"` on the user's own clock, never a UTC instant,
 * so a 06:30 class stays at 06:30 across a daylight-saving change (see
 * `lib/timezone.ts`). Everything here is pure, so it can be tested directly.
 */

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

export function isDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value)
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
