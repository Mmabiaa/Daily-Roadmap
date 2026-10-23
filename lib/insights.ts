import { getDb } from './mongodb.ts'
import type { CategoryName, EventDoc } from './models.ts'
import { normalizeEvents, resolveDay } from './resolver.ts'
import { addDays } from './schedule-time.ts'
import { planFloor, progressSummary, timezoneFor } from './schedule-service.ts'
import { todayIn } from './timezone.ts'

/**
 * What the account keeps, and what slips — read from its own history.
 *
 * Every count here is deterministic arithmetic over rows the app already
 * stores: an event's resolved occurrences on days that are over, and the
 * completions against them. No model, no guesswork, and no number that cannot
 * be traced back to a tick the person made themselves.
 */

const EVENTS = 'events'
const COMPLETIONS = 'completions'

/** How much history to walk, once the plan is older than that. */
const INSIGHT_DAYS = 42

/**
 * How many times an event must have come round before its rate means anything.
 * One occurrence is a coin toss, not a habit, so it is never judged.
 */
const MIN_OCCURRENCES = 2

/** How often a block has to be done to count as a strength, and as a slip. */
const STRENGTH_RATE = 0.7
const SLIP_RATE = 0.34

/** How many blocks each side of the review shows. */
const PER_LIST = 4

/** One block's record across the window. */
export type InsightItem = {
  eventId: string
  title: string
  category: CategoryName
  /** Days it was scheduled on, excluding today. */
  occurred: number
  /** Of those, how many were ticked. */
  done: number
  /** `done / occurred`, from 0 to 1. */
  rate: number
}

export type Insights = {
  timezone: string
  today: string
  /** How many days the analysis covers, before the plan's own floor. */
  windowDays: number
  streak: number
  comebacks: number
  /** Blocks ticked most reliably — what the account keeps. */
  strengths: InsightItem[]
  /** Blocks ticked least — what slips. */
  slips: InsightItem[]
  /** How many blocks carried enough history to be judged. */
  tracked: number
}

export async function getInsights(ownerId: string): Promise<Insights> {
  const db = await getDb()
  const timezone = await timezoneFor(ownerId)
  const today = todayIn(timezone)

  const events: EventDoc[] = normalizeEvents(
    (await db.collection(EVENTS).find({ ownerId }).toArray()) as any
  )

  // Neither this walk nor the streak should reach back before the plan existed,
  // or a weekly event with no start date would look like a month of misses.
  const floor = planFloor(events, timezone)
  let from = addDays(today, -INSIGHT_DAYS)
  if (floor && floor > from) from = floor

  // When each event came round, on a day that is already over. Today is left
  // out because it is still open, and a partial day reads as a miss.
  const scheduled = new Map<string, { title: string; category: CategoryName; dates: Set<string> }>()
  for (let date = from; date < today; date = addDays(date, 1)) {
    for (const block of resolveDay(events, date)) {
      const entry = scheduled.get(block.eventId)
      if (entry) entry.dates.add(date)
      else
        scheduled.set(block.eventId, {
          title: block.title,
          category: block.category,
          dates: new Set([date]),
        })
    }
  }

  const rows = await db
    .collection(COMPLETIONS)
    .find({ ownerId, date: { $gte: from, $lt: today } })
    .toArray()

  const doneByEvent = new Map<string, number>()
  for (const row of rows) {
    const id = String(row.eventId)
    doneByEvent.set(id, (doneByEvent.get(id) ?? 0) + 1)
  }

  const items: InsightItem[] = []
  for (const [eventId, entry] of scheduled) {
    const occurred = entry.dates.size
    if (occurred < MIN_OCCURRENCES) continue
    // A completion can only be counted for a day the event came round.
    const done = Math.min(doneByEvent.get(eventId) ?? 0, occurred)
    items.push({
      eventId,
      title: entry.title,
      category: entry.category,
      occurred,
      done,
      rate: done / occurred,
    })
  }

  const { streak, comebacks } = await progressSummary(ownerId, timezone, today, events)

  const strengths = items
    .filter((item) => item.rate >= STRENGTH_RATE)
    .sort((a, b) => b.rate - a.rate || b.done - a.done)
    .slice(0, PER_LIST)
  const slips = items
    .filter((item) => item.rate <= SLIP_RATE)
    .sort((a, b) => a.rate - b.rate || b.occurred - a.occurred)
    .slice(0, PER_LIST)

  return {
    timezone,
    today,
    windowDays: INSIGHT_DAYS,
    streak,
    comebacks,
    strengths,
    slips,
    tracked: items.length,
  }
}
