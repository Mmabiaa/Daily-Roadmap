/**
 * The words and small rules the Phase 2 screens share.
 *
 * Pure and browser-safe on purpose: onboarding, Settings and the Guide all read
 * the same labels, and a label written twice is a label that drifts. Types are
 * imported with `import type` so neither Zod nor the database reaches the
 * browser bundle.
 */

import type { CategoryName, Clock, MustDo, Persona } from './models.ts'
import type { BlockView } from './resolver.ts'
import { addDays, durationMinutes, minutesOf } from './schedule-time.ts'

/** What kind of day the account is built around, and the one line that explains it. */
export const PERSONA_OPTIONS: { id: Persona; label: string; blurb: string }[] = [
  { id: 'student', label: 'Student', blurb: 'Classes and study, around your timetable.' },
  { id: 'worker', label: '9-to-5 worker', blurb: 'Fixed office hours, evenings free.' },
  { id: 'freelancer', label: 'Freelancer', blurb: 'Hours you set, projects you choose.' },
  { id: 'shift', label: 'Shift worker', blurb: 'Shifts that move from week to week.' },
]

/** The goals offered at the start. Any of them can be swapped in Settings. */
export const GOAL_PRESETS = [
  'Exercise',
  'Deep study',
  'Sleep well',
  'Side project',
  'Eat well',
  'See people',
]

/** The must-dos, and what each one means on a Minimum day. */
export const MUST_DO_OPTIONS: { id: MustDo; label: string; hint: string }[] = [
  { id: 'wake', label: 'Wake on time', hint: 'Up at your usual time' },
  { id: 'study', label: 'One study block', hint: 'One focused stretch' },
  { id: 'move', label: 'Move your body', hint: 'A walk counts' },
  { id: 'project', label: 'One step on your project', hint: 'One small commit' },
  { id: 'winddown', label: 'Wind down', hint: 'Phone parked before bed' },
  { id: 'sleep', label: 'Lights out on time', hint: 'The night the day needs' },
]

/** How many must-dos a Minimum day takes. */
export const MUST_DO_MIN = 3
export const MUST_DO_MAX = 5

/** `HH:MM` read on the account's own clock (12- or 24-hour). */
export function formatClock(time: string, clock: Clock): string {
  const [hours, minutes] = time.split(':').map(Number)
  if (clock === '24') return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

/**
 * How many days in a row have been logged as low, counting back from `today`.
 *
 * A day the person never answered ends the run rather than being looked past,
 * so this follows two genuinely low days in a row — not two low days a
 * fortnight apart — and drives the "take it gently" nudge.
 */
export function lowEnergyRun(
  energy: Record<string, 'low' | 'okay' | 'high'>,
  today: string
): number {
  let run = 0
  let date = today
  while (energy[date] === 'low') {
    run += 1
    date = addDays(date, -1)
  }
  return run
}

/** The channel each preset goal points at, so a day's line can name the block. */
const GOAL_CATEGORY: Record<string, CategoryName> = {
  Exercise: 'body',
  'Deep study': 'study',
  'Side project': 'project',
  'Eat well': 'eat',
  'See people': 'people',
}

/** The widest free stretch between two classes, or `null` when they run back to back. */
function largestGap(classes: BlockView[]): { from: string; to: string; minutes: number } | null {
  let best: { from: string; to: string; minutes: number } | null = null
  for (let i = 1; i < classes.length; i += 1) {
    const from = classes[i - 1].end
    const to = classes[i].start
    const minutes = minutesOf(to) - minutesOf(from)
    if (minutes > 0 && (!best || minutes > best.minutes)) best = { from, to, minutes }
  }
  return best
}

/** The first block a preset goal points at, preferring an essential one. */
function goalBlock(
  blocks: BlockView[],
  goals: string[]
): { goal: string; block: BlockView } | null {
  for (const goal of goals) {
    const category = GOAL_CATEGORY[goal]
    if (!category) continue
    const block =
      blocks.find((b) => b.category === category && b.essential) ??
      blocks.find((b) => b.category === category)
    if (block) return { goal, block }
  }
  return null
}

/**
 * One line about a day, read from the day itself rather than a fixed template.
 *
 * The line used to be a hard-coded sentence per weekday, written for the one
 * seeded account — so every other account opened the week to a stranger's
 * timetable. This derives it from the blocks that actually resolve: a
 * class-heavy day names the gap between classes worth protecting, a lighter
 * one points at the goal the person set, and a day with nothing on it says so.
 * Goals are matched by their preset labels; a goal typed by hand has no
 * category to point at and is simply skipped.
 */
export function dayFocus(blocks: BlockView[], goals: string[], clock: Clock): string {
  const fmt = (time: string) => formatClock(time, clock)

  if (blocks.length === 0) return 'Nothing planned yet — add a block when you are ready.'

  const classes = blocks
    .filter((block) => block.category === 'class')
    .slice()
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start))

  const goal = goalBlock(blocks, goals)

  if (classes.length === 0) {
    return goal
      ? `No classes today. Keep your ${goal.goal.toLowerCase()} block at ${fmt(goal.block.start)}.`
      : 'No classes today. A clear day — spend it on purpose.'
  }

  const classMinutes = classes.reduce(
    (total, block) => total + durationMinutes(block.start, block.end),
    0
  )

  if (classes.length >= 3 || classMinutes >= 180) {
    const gap = largestGap(classes)
    if (gap && gap.minutes >= 45) {
      return `Long class day. Protect the ${fmt(gap.from)} to ${fmt(gap.to)} gap.`
    }
    return 'Long class day. Eat well, and keep the evening light.'
  }

  const tail = goal ? ` Keep your ${goal.goal.toLowerCase()} block at ${fmt(goal.block.start)}.` : ''
  return classes.length === 1
    ? `One class at ${fmt(classes[0].start)}.${tail || ' The rest of the day is yours.'}`
    : `Two classes today.${tail || ' Use the space between them well.'}`
}
