import { Block, Day, days } from '@/lib/schedule'

export const keyFor = (date: string, day: Day, i: number) =>
  `fyr:${date}:${day}:${i}`

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