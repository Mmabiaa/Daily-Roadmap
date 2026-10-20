import type { CategoryName, DayName, EventDoc, Kind, Source } from './models.ts'
import { addDays, durationMinutes, isTime, legacyEnd, minutesOf, overlaps, weekdayOf } from './schedule-time.ts'

/**
 * The schedule resolver.
 *
 * A stored event says *when it applies* (a weekday set or one date, inside an
 * optional date window); the resolver turns that plus a target date into the
 * ordered blocks that date actually shows. All of it is pure — events and a
 * date go in, sorted blocks come out — so every rule (recurrence, the date
 * window, per-date exceptions, ordering) is testable without a database.
 *
 * The date is expected to already be the user's own wall-clock date, because a
 * block's time is a time on *their* clock: the caller gets it from
 * `nowIn`/`todayIn` in `lib/timezone.ts`. The resolver therefore needs no zone
 * of its own, and the thin `getDay` wrapper below is the only DB-aware part.
 */

/** One resolved block for a date: an event, with any exception applied. */
export type DayBlock = {
  /** The event it came from — the key a completion is stored under. */
  eventId: string
  title: string
  category: CategoryName
  kind: Kind
  /** `HH:MM` on the user's clock, after any per-date override. */
  start: string
  end: string
  essential: boolean
  note?: string
  source: Source
}

/** A stored event as it comes back from the driver, before normalisation. */
type RawEvent = Record<string, any>

/** True when a row is already in the v2 shape (has a real start, end, repeat). */
function isStoredEvent(doc: RawEvent): boolean {
  return isTime(doc?.start) && isTime(doc?.end) && typeof doc?.repeat === 'object' && doc.repeat !== null
}

/**
 * Reads one row into the v2 shape — the single place legacy rows are understood.
 *
 * Rows written before Phase 1A have a `day` and a `time` and no stored end.
 * They are only ever seen here, so the whole legacy interpretation lives in
 * this one function. The migration rewrites real data into the v2 shape, so
 * this is a safety net, not a path anything new should take.
 *
 * @deprecated remove in Phase 1B once every row is migrated.
 */
export function normalizeLegacyEvent(doc: RawEvent, end?: string | null): EventDoc {
  if (isStoredEvent(doc)) {
    return {
      ...(doc as EventDoc),
      ownerId: String(doc.ownerId ?? doc.userId ?? ''),
      essential: Boolean(doc.essential),
      exceptions: Array.isArray(doc.exceptions) ? doc.exceptions : [],
      source: (doc.source as Source) ?? 'user',
    }
  }

  const start = String(doc.time)
  return {
    ...(doc._id != null ? { _id: String(doc._id) } : {}),
    ownerId: String(doc.ownerId ?? doc.userId ?? ''),
    title: String(doc.title ?? ''),
    category: doc.category as CategoryName,
    // Same mapping the migration uses: a class is fixed, everything else moves.
    kind: doc.category === 'class' ? 'fixed' : 'flexible',
    start,
    end: end ?? legacyEnd(start),
    repeat: { type: 'weekly', days: [String(doc.day) as DayName] },
    essential: Boolean(doc.essential),
    exceptions: [],
    source: 'user',
    ...(doc.note ? { note: String(doc.note) } : {}),
    ...(doc.createdAt instanceof Date ? { createdAt: doc.createdAt } : {}),
  }
}

/**
 * Normalises a whole owner's worth of rows, giving each legacy row the end it
 * used to have.
 *
 * A legacy block's length came from the *next* block on the same weekday (the
 * last one ran to `LAST_WAKE`), so the neighbours have to be found before the
 * row can be read. This is exactly the computation the migration performs, and
 * keeping it here means an unmigrated row still resolves to its old length.
 */
export function normalizeEvents(docs: RawEvent[]): EventDoc[] {
  const legacyEnds = new Map<RawEvent, string>()
  const byDay = new Map<string, RawEvent[]>()

  for (const doc of docs) {
    if (isStoredEvent(doc)) continue
    const day = String(doc.day ?? '')
    const list = byDay.get(day)
    if (list) list.push(doc)
    else byDay.set(day, [doc])
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => minutesOf(String(a.time)) - minutesOf(String(b.time)))
    list.forEach((doc, i) => {
      const next = list[i + 1]
      legacyEnds.set(doc, legacyEnd(String(doc.time), next ? String(next.time) : null))
    })
  }

  return docs.map((doc) => normalizeLegacyEvent(doc, legacyEnds.get(doc)))
}

/** Whether an event is scheduled to happen on `date`. */
function occursOn(event: EventDoc, date: string, weekday: DayName): boolean {
  // ISO dates compare correctly as plain strings.
  if (event.startDate && date < event.startDate) return false
  if (event.endDate && date > event.endDate) return false
  if (event.repeat.type === 'once') return event.repeat.date === date
  return event.repeat.days.includes(weekday)
}

/**
 * The blocks a date shows, in the order they happen.
 *
 * Blocks that start at the same time are kept in a stable order — oldest
 * `createdAt` first, then by id — so the list never reshuffles between reads
 * and a tick stays attached to the same event.
 */
export function resolveDay(events: EventDoc[], date: string): DayBlock[] {
  const weekday = weekdayOf(date)
  const rows: { block: DayBlock; createdAt: number }[] = []

  for (const event of events) {
    if (!occursOn(event, date, weekday)) continue

    const exception = event.exceptions?.find((entry) => entry.date === date)
    if (exception?.skip) continue

    const note = exception?.note ?? event.note
    rows.push({
      createdAt: event.createdAt?.getTime() ?? 0,
      block: {
        eventId: String(event._id ?? ''),
        title: exception?.title ?? event.title,
        category: event.category,
        kind: event.kind,
        start: exception?.start ?? event.start,
        end: exception?.end ?? event.end,
        essential: exception?.essential ?? event.essential,
        ...(note ? { note } : {}),
        source: event.source,
      },
    })
  }

  rows.sort(
    (a, b) =>
      minutesOf(a.block.start) - minutesOf(b.block.start) ||
      a.createdAt - b.createdAt ||
      a.block.eventId.localeCompare(b.block.eventId)
  )

  return rows.map((row) => row.block)
}

/** Whether an event is scheduled to happen on `date`, before exceptions. */
export function appliesOn(event: EventDoc, date: string): boolean {
  return occursOn(event, date, weekdayOf(date))
}

/** Whether an event has been skipped for `date` by an exception. */
export function skippedOn(event: EventDoc, date: string): boolean {
  return Boolean(event.exceptions?.some((entry) => entry.date === date && entry.skip))
}

/** The date window an event can occur in, as `[from, to]` ISO strings. */
function dateWindow(event: EventDoc): { from: string; to: string } {
  if (event.repeat.type === 'once') return { from: event.repeat.date, to: event.repeat.date }
  return { from: event.startDate ?? '0000-01-01', to: event.endDate ?? '9999-12-31' }
}

/**
 * Whether two events clash.
 *
 * Only fixed events can: a flexible block is meant to be moved over anything,
 * so it never conflicts. Two fixed events clash when they share a weekday, the
 * windows they run in overlap, and their times overlap (an end at or before the
 * start means it runs into the next morning, which `overlaps` already handles).
 * A date either event has skipped does not count as a clash, so the walk looks
 * at the first few shared dates rather than just the first.
 */
export function conflicts(a: EventDoc, b: EventDoc): boolean {
  if (a.kind !== 'fixed' || b.kind !== 'fixed') return false
  if (!overlaps(a.start, a.end, b.start, b.end)) return false

  const wa = dateWindow(a)
  const wb = dateWindow(b)
  const from = wa.from > wb.from ? wa.from : wb.from
  const to = wa.to < wb.to ? wa.to : wb.to
  if (from > to) return false

  // Any two weekday sets that intersect do so within a week, so eight days is
  // enough to find a shared date (and to step past a skipped one).
  for (let offset = 0; offset < 8; offset += 1) {
    const date = addDays(from, offset)
    if (date > to) return false
    if (
      appliesOn(a, date) &&
      appliesOn(b, date) &&
      !skippedOn(a, date) &&
      !skippedOn(b, date)
    ) {
      return true
    }
  }
  return false
}

/** A short, human label for an event, used when reporting a clash. */
export function describeEvent(event: EventDoc): string {
  const when =
    event.repeat.type === 'once' ? event.repeat.date : event.repeat.days.join('/')
  return `${event.title} (${when} ${event.start}–${event.end})`
}

/** Where a block sits now: the block in progress, the next one, and the count. */
export type DayStatus = {
  current: DayBlock | null
  next: DayBlock | null
  /** Whole minutes until the current block ends, or `null` when none is running. */
  minutesLeft: number | null
}

/** True when `now` (minutes past midnight) falls inside the block's [start, end). */
function containsNow(block: DayBlock, now: number): boolean {
  const length = durationMinutes(block.start, block.end)
  // A zero-length block occupies no time, so nothing is ever "in" it.
  if (length === 0) return false

  const start = minutesOf(block.start)
  const end = start + length
  // The second comparison lets a block that ran past midnight still match an
  // early-morning `now` (its start belongs to the previous calendar date).
  return (now >= start && now < end) || (now + 1440 >= start && now + 1440 < end)
}

/**
 * Works out what is happening at `now` on a resolved day.
 *
 * The current block is the *latest-starting* one that contains `now`, so when
 * a flexible block sits on top of a fixed one, the more recent wins. `next` is
 * the following block still to start. Both are computed from the explicit ends,
 * never from the neighbour — which is the whole point of storing them.
 */
export function dayStatus(blocks: DayBlock[], now: number): DayStatus {
  const minutes = ((now % 1440) + 1440) % 1440

  let current: DayBlock | null = null
  let currentStart = -1
  for (const block of blocks) {
    if (!containsNow(block, minutes)) continue
    const start = minutesOf(block.start)
    // Blocks are already sorted, so `>=` keeps the last of equal starts.
    if (start >= currentStart) {
      current = block
      currentStart = start
    }
  }

  let next: DayBlock | null = null
  for (const block of blocks) {
    if (minutesOf(block.start) > minutes) {
      next = block
      break
    }
  }

  return { current, next, minutesLeft: current ? minutesUntilEnd(current, minutes) : null }
}

/** Minutes from `now` to the end of the block in progress, over a midnight wrap. */
function minutesUntilEnd(block: DayBlock, now: number): number {
  const start = minutesOf(block.start)
  const end = start + durationMinutes(block.start, block.end)
  const reference = now >= start && now < end ? now : now + 1440
  return end - reference
}

/** How many of the day's essential blocks are ticked. */
export function essentialProgress(
  blocks: DayBlock[],
  doneEventIds: Iterable<string>
): { essential: number; done: number } {
  const done = new Set(doneEventIds)
  let essential = 0
  let completed = 0

  for (const block of blocks) {
    if (!block.essential) continue
    essential += 1
    if (done.has(block.eventId)) completed += 1
  }

  return { essential, done: completed }
}

/** One day's essential tally, as the streak walks back through them. */
export type StreakDay = { date: string; essential: number; done: number }

/**
 * Counts consecutive days ending at the most recent entry.
 *
 * `days` must be newest-first. A day with no essential block is *neutral* — it
 * neither adds to the streak nor breaks it, so a rest day does not punish you.
 * The first day with an essential block left unfinished stops the count; before
 * that, one that is fully ticked adds one. `floorDate` (the account's first
 * event) stops the walk, so a streak is never counted before the plan existed.
 */
export function streakFrom(days: StreakDay[], floorDate?: string): number {
  let streak = 0

  for (const day of days) {
    if (floorDate && day.date < floorDate) break
    if (day.essential === 0) continue
    if (day.done >= day.essential) streak += 1
    else break
  }

  return streak
}
