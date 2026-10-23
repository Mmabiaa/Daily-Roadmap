/**
 * Onboarding and timetable import — the pure half.
 *
 * Two jobs, both testable without a database: turning a wake/sleep pair and a
 * set of must-dos into a starter plan, and turning a pasted timetable into
 * class events. Both are deliberately forgiving — the plan is a draft the
 * person edits, and the parser skips anything it cannot read rather than
 * refusing the whole paste.
 */

import type { CategoryName, DayName, MustDo } from './models.ts'
import { DAY_NAMES } from './models.ts'
import { timeOf } from './schedule-time.ts'

/** A block the starter plan will create. */
export type DraftBlock = {
  title: string
  category: CategoryName
  kind: 'fixed' | 'flexible'
  start: string
  end: string
  repeat: { type: 'weekly'; days: DayName[] }
  essential: boolean
}

/** One class read out of a pasted timetable. */
export type TimetableClass = {
  title: string
  days: DayName[]
  start: string
  end: string
}

/** A block in the draft, before the must-do rule is applied. */
type Step = {
  /** Minutes after the wake time (negative counts back from sleep). */
  from: 'wake' | 'sleep' | 'clock'
  offset: number
  minutes: number
  title: string
  category: CategoryName
  /** The must-do this block satisfies, if any. */
  must?: MustDo
}

/**
 * The shape of the drafted day, written as offsets so it follows whatever
 * wake and sleep the person chose. Enough to feel like a real day, few enough
 * to still be edited in a minute.
 */
const STEPS: Step[] = [
  { from: 'wake', offset: 0, minutes: 30, title: 'Wake · water · make bed', category: 'body', must: 'wake' },
  { from: 'wake', offset: 30, minutes: 30, title: 'Breakfast', category: 'eat' },
  { from: 'wake', offset: 120, minutes: 50, title: 'Deep study: hardest course first', category: 'study', must: 'study' },
  { from: 'wake', offset: 210, minutes: 15, title: 'Break · walk · water', category: 'rest' },
  { from: 'clock', offset: 17 * 60, minutes: 45, title: 'Move your body', category: 'body', must: 'move' },
  { from: 'clock', offset: 19 * 60, minutes: 45, title: 'Dinner', category: 'eat' },
  { from: 'clock', offset: 20 * 60, minutes: 45, title: 'Side project: one small step', category: 'project', must: 'project' },
  { from: 'sleep', offset: -60, minutes: 60, title: 'Wind down: phone parked · read · journal', category: 'rest', must: 'winddown' },
  { from: 'sleep', offset: 0, minutes: 0, title: 'Lights out', category: 'sleep', must: 'sleep' },
]

/** A time string back to minutes after midnight. */
const minutesOfTime = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * The account's first week, drafted from its wake and sleep times.
 *
 * Every block repeats on all seven days, so one event covers the week rather
 * than seven — the timeline then shows the same shape each day, which is what
 * a person is being shown when they "look at the week". Blocks whose must-do
 * was not picked are still created; they simply are not essential, so they fall
 * away when the Minimum day is switched on.
 */
export function draftStarterPlan(input: {
  wake: string
  sleep: string
  essentials: readonly MustDo[]
}): DraftBlock[] {
  const wake = minutesOfTime(input.wake)
  const sleep = minutesOfTime(input.sleep)
  const chosen = new Set<MustDo>(input.essentials)

  // The night's length, over midnight. A sleep time at or before the wake time
  // means the night starts today and ends tomorrow.
  const night = ((wake - sleep + 1440) % 1440) || 8 * 60

  return STEPS.map((step) => {
    const start =
      step.from === 'wake' ? wake + step.offset
        : step.from === 'sleep' ? sleep + step.offset
          : step.offset

    const minutes = step.minutes
    return {
      title: step.title,
      category: step.category,
      kind: 'flexible' as const,
      start: timeOf(start),
      end: timeOf(minutes > 0 ? start + minutes : start + night),
      repeat: { type: 'weekly' as const, days: [...DAY_NAMES] },
      essential: step.must ? chosen.has(step.must) : false,
    }
  })
}

/** Weekday names a pasted timetable may use, longest first so "Monday" wins. */
const DAY_ALIASES: Record<string, DayName> = {
  monday: 'Mon', mon: 'Mon',
  tuesday: 'Tue', tue: 'Tue', tues: 'Tue',
  wednesday: 'Wed', wed: 'Wed',
  thursday: 'Thu', thu: 'Thu', thur: 'Thu', thurs: 'Thu',
  friday: 'Fri', fri: 'Fri',
  saturday: 'Sat', sat: 'Sat',
  sunday: 'Sun', sun: 'Sun',
}

const DAY_LOOKUP = Object.keys(DAY_ALIASES).sort((a, b) => b.length - a.length)

/** `08:30-10:00` (also `8:30`, `08.30`, an en dash, or two separate times). */
const RANGE_PATTERN = /(\d{1,2}[:.]\d{2})\s*(?:-|–|—|to|until)\s*(\d{1,2}[:.]\d{2})/i

/** `08:30` padded to two digits; `null` when it is not a real clock time. */
function normalizeClock(raw: string): string | null {
  const match = raw.match(/^(\d{1,2})[:.](\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const mins = Number(match[2])
  if (hours > 23 || mins > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

/** Every weekday name in a chunk of text, in week order and without repeats. */
function daysIn(text: string): DayName[] {
  const lowered = text.toLowerCase()
  const found = new Set<DayName>()
  for (const alias of DAY_LOOKUP) {
    // A word boundary either side keeps "mon" out of "monitor".
    if (new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`).test(lowered)) {
      found.add(DAY_ALIASES[alias])
    }
  }
  return DAY_NAMES.filter((day) => found.has(day))
}

/**
 * Reads class events out of a pasted timetable, one line per class.
 *
 * A line is expected to name one or more weekdays, a time range, and a title:
 * `Mon, Wed 08:30-10:00 CE 481 Data Communication`. Days may sit on either
 * side of the range, and a line without a weekday or a time range is skipped,
 * so a heading or a blank line is harmless. Lines that agree on their times and
 * title are merged, which means "Mon 08:30-10:00 Networks" and "Fri 08:30-10:00
 * Networks" become one weekly event rather than two.
 */
export function parseTimetable(text: string): TimetableClass[] {
  const merged = new Map<string, TimetableClass>()

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    const range = line.match(RANGE_PATTERN)
    if (!range) continue

    const start = normalizeClock(range[1])
    const end = normalizeClock(range[2])
    if (!start || !end) continue

    const [before, after] = [line.slice(0, range.index), line.slice((range.index ?? 0) + range[0].length)]
    const days = Array.from(new Set([...daysIn(before), ...daysIn(after)]))
    if (days.length === 0) continue

    // The title is whatever is left once the days and times are taken out.
    let title = after
    for (const alias of DAY_LOOKUP) {
      title = title.replace(new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`, 'gi'), ' ')
    }
    title = title.replace(/^[\s\-–—:,.|]+|[\s\-–—:,.|]+$/g, '').replace(/\s{2,}/g, ' ')

    const key = `${start}|${end}|${title.toLowerCase()}`
    const existing = merged.get(key)
    if (existing) {
      existing.days = DAY_NAMES.filter((day) => existing.days.includes(day) || days.includes(day))
    } else {
      merged.set(key, { title: title || 'Class', days, start, end })
    }
  }

  return [...merged.values()]
}

/** The class events a timetable becomes: fixed, weekly, and never essential. */
export function timetableBlocks(classes: TimetableClass[]): DraftBlock[] {
  return classes.map((entry) => ({
    title: entry.title,
    category: 'class' as const,
    kind: 'fixed' as const,
    start: entry.start,
    end: entry.end,
    repeat: { type: 'weekly' as const, days: entry.days },
    essential: false,
  }))
}
