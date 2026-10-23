/**
 * The words and small rules the Phase 2 screens share.
 *
 * Pure and browser-safe on purpose: onboarding, Settings and the Guide all read
 * the same labels, and a label written twice is a label that drifts. Types are
 * imported with `import type` so neither Zod nor the database reaches the
 * browser bundle.
 */

import type { Clock, MustDo, Persona } from './models.ts'
import { addDays } from './schedule-time.ts'

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
