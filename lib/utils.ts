import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { Block, Day, days } from '@/lib/schedule'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Stable per-block key. Keyed by start time (unique within a day) so that
 *  adding or removing events never shifts another block's check state. */
export const keyFor = (date: string, day: Day, time: string) =>
  `fyr:${date}:${day}:${time}`

export const todayInfo = () => {
  const d = new Date()
  return {
    date: d.toISOString().slice(0, 10),
    day: days[(d.getDay() + 6) % 7] as Day,
  }
}

export const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export const formatTime = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

export const duration = (block: Block, next?: Block, lastWake = '05:30') => {
  let end = next ? minutes(next.time) : minutes(lastWake)
  let start = minutes(block.time)
  if (end <= start) end += 1440
  return end - start
}

export const dateForDay = (day: Day, base = new Date()) => {
  const i = days.indexOf(day)
  const current = (base.getDay() + 6) % 7
  const d = new Date(base)
  d.setDate(base.getDate() + i - current)
  return d.toISOString().slice(0, 10)
}

/** Vibrate on supporting devices. Safe to call on server / unsupported browsers. */
export const haptic = (ms = 8) => {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(ms)
  } catch {
    /* ignore */
  }
}