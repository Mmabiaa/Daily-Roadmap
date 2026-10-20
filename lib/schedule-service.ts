import { ObjectId, type Db } from 'mongodb'

import { ApiError } from './errors.ts'
import type {
  CategoryName,
  CompletionToggle,
  EventDoc,
  EventInput,
  EventUpdate,
  Repeat,
  Source,
} from './models.ts'
import { ensureIndexes, getDb } from './mongodb.ts'
import {
  appliesOn,
  conflicts,
  describeEvent,
  essentialProgress,
  normalizeEvents,
  normalizeLegacyEvent,
  resolveDay,
  skippedOn,
  streakFrom,
  type DayBlock,
  type StreakDay,
} from './resolver.ts'
import { addDays, dayBefore, isDate, overlaps, weekStartOf } from './schedule-time.ts'
import { normalizeTimeZone, todayIn } from './timezone.ts'

/**
 * Everything the schedule API does, without knowing about HTTP.
 *
 * Each function takes the owner id it was given by `requireUser()` and scopes
 * every query by it, so another account's rows simply do not match and become a
 * 404. Keeping this apart from the route handlers means it can be exercised
 * against a real database in tests, which is where the concurrency and index
 * behaviour actually has to be checked.
 */

const EVENTS = 'events'
const COMPLETIONS = 'completions'

/** How many events one account may keep. */
export const MAX_EVENTS = 400

/** How far back the streak will look for a run, so a bad date cannot hang it. */
const STREAK_LOOKBACK_DAYS = 400

/** The fields a client may set, shared by create and edit. */
type EventFields = {
  title: string
  category: CategoryName
  kind: EventDoc['kind']
  start: string
  end: string
  repeat: Repeat
  startDate?: string
  endDate?: string
  note?: string
  essential?: boolean
  exceptions?: EventDoc['exceptions']
}

/** An event as the API returns it: ids as strings, no internal fields. */
export type SerializedEvent = {
  _id: string
  title: string
  category: CategoryName
  kind: EventDoc['kind']
  start: string
  end: string
  repeat: Repeat
  startDate?: string
  endDate?: string
  essential: boolean
  exceptions: EventDoc['exceptions']
  source: Source
  note?: string
}

/** A resolved block plus whether it has been ticked off. */
export type BlockView = DayBlock & { done: boolean }

export type DayView = {
  timezone: string
  today: string
  date: string
  blocks: BlockView[]
  streak: number
}

export type WeekView = {
  timezone: string
  today: string
  weekStart: string
  days: { date: string; blocks: BlockView[] }[]
  streak: number
}

function serializeEvent(event: EventDoc): SerializedEvent {
  return {
    _id: String(event._id ?? ''),
    title: event.title,
    category: event.category,
    kind: event.kind,
    start: event.start,
    end: event.end,
    repeat: event.repeat,
    ...(event.startDate ? { startDate: event.startDate } : {}),
    ...(event.endDate ? { endDate: event.endDate } : {}),
    essential: Boolean(event.essential),
    exceptions: event.exceptions ?? [],
    source: event.source ?? 'user',
    ...(event.note ? { note: event.note } : {}),
  }
}

/** The zone the owner's wall-clock times belong to. */
export async function timezoneFor(ownerId: string): Promise<string> {
  if (!ObjectId.isValid(ownerId)) return normalizeTimeZone(undefined)
  const db = await getDb()
  const user = await db.collection('users').findOne({ _id: new ObjectId(ownerId) })
  return normalizeTimeZone(user?.timezone)
}

/** Loads one of the owner's events, or answers 404. */
async function loadOwnedEvent(
  db: Db,
  ownerId: string,
  id: string
): Promise<{ _id: ObjectId; event: EventDoc }> {
  if (!ObjectId.isValid(id)) throw new ApiError(404, 'Event not found')
  const _id = new ObjectId(id)
  const raw = await db.collection(EVENTS).findOne({ _id, ownerId })
  if (!raw) throw new ApiError(404, 'Event not found')
  return { _id, event: normalizeLegacyEvent(raw as any) }
}

/** Turns validated input into the document that gets stored. */
function toStored(ownerId: string, fields: EventFields, source: Source) {
  return {
    ownerId,
    title: fields.title,
    category: fields.category,
    kind: fields.kind,
    start: fields.start,
    end: fields.end,
    repeat: fields.repeat,
    ...(fields.startDate ? { startDate: fields.startDate } : {}),
    ...(fields.endDate ? { endDate: fields.endDate } : {}),
    essential: fields.essential ?? false,
    exceptions: fields.exceptions ?? [],
    source,
    ...(fields.note ? { note: fields.note } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** Every fixed event of the owner that the candidate would clash with. */
async function findClash(
  ownerId: string,
  candidate: EventDoc,
  ignoreId?: ObjectId
): Promise<EventDoc | null> {
  if (candidate.kind !== 'fixed') return null

  const db = await getDb()
  const filter: Record<string, unknown> = { ownerId, kind: 'fixed' }
  if (ignoreId) filter._id = { $ne: ignoreId }

  for (const raw of await db.collection(EVENTS).find(filter).toArray()) {
    const existing = normalizeLegacyEvent(raw as any)
    if (conflicts(candidate, existing)) return existing
  }
  return null
}

/** Every fixed event the candidate would clash with on one specific date. */
async function findClashOnDate(
  ownerId: string,
  date: string,
  candidate: EventDoc,
  ignoreId?: ObjectId
): Promise<EventDoc | null> {
  if (candidate.kind !== 'fixed' || skippedOn(candidate, date)) return null

  const db = await getDb()
  const filter: Record<string, unknown> = { ownerId, kind: 'fixed' }
  if (ignoreId) filter._id = { $ne: ignoreId }

  for (const raw of await db.collection(EVENTS).find(filter).toArray()) {
    const existing = normalizeLegacyEvent(raw as any)
    if (existing.kind !== 'fixed') continue
    if (!appliesOn(existing, date) || skippedOn(existing, date)) continue
    if (overlaps(candidate.start, candidate.end, existing.start, existing.end)) return existing
  }
  return null
}

/** The owner's stored events, oldest first. */
export async function listEvents(ownerId: string): Promise<SerializedEvent[]> {
  const db = await getDb()
  const docs = await db
    .collection(EVENTS)
    .find({ ownerId })
    .sort({ createdAt: 1 })
    .toArray()
  return docs.map((doc) => serializeEvent(normalizeLegacyEvent(doc as any)))
}

export async function createEvent(ownerId: string, input: EventInput): Promise<SerializedEvent> {
  const db = await getDb()
  await ensureIndexes()

  const count = await db.collection(EVENTS).countDocuments({ ownerId })
  if (count >= MAX_EVENTS) {
    throw new ApiError(400, `You can have at most ${MAX_EVENTS} events.`)
  }

  const stored = toStored(ownerId, input, 'user')
  const clash = await findClash(ownerId, normalizeLegacyEvent(stored as any))
  if (clash) throw new ApiError(409, `That time clashes with ${describeEvent(clash)}`)

  const result = await db.collection(EVENTS).insertOne(stored)
  return serializeEvent(normalizeLegacyEvent({ ...stored, _id: result.insertedId } as any))
}

/**
 * Applies an edit to one of the owner's events.
 *
 * `scope: 'this'` changes only `date`, as an exception on the series.
 * `scope: 'future'` splits the series at `date`: the part before it is kept
 * (the old event's `endDate` moves to the day before) and the edited values
 * start a new event on `date`. Editing on or before the series' first day
 * replaces the series outright — old event and its completions both go, so no
 * tick is left pointing at a block that no longer exists.
 */
export async function updateEvent(
  ownerId: string,
  id: string,
  update: EventUpdate
): Promise<SerializedEvent> {
  const db = await getDb()
  const { _id, event } = await loadOwnedEvent(db, ownerId, id)

  const date = update.date
  if (!date || !isDate(date)) {
    throw new ApiError(400, 'A date is required to change a repeating event')
  }

  if (update.scope === 'this') {
    if (!appliesOn(event, date) || skippedOn(event, date)) {
      throw new ApiError(400, 'That event does not occur on that date')
    }

    const candidate: EventDoc = { ...event, start: update.start, end: update.end }
    const clash = await findClashOnDate(ownerId, date, candidate, _id)
    if (clash) throw new ApiError(409, `That time clashes with ${describeEvent(clash)}`)

    const exceptions = [
      ...event.exceptions.filter((entry) => entry.date !== date),
      {
        date,
        start: update.start,
        end: update.end,
        title: update.title,
        essential: update.essential ?? false,
        ...(update.note ? { note: update.note } : {}),
      },
    ]

    const updatedAt = new Date()
    await db
      .collection(EVENTS)
      .updateOne({ _id, ownerId }, { $set: { exceptions, updatedAt } })
    return serializeEvent({ ...event, _id: id, exceptions, updatedAt })
  }

  const fields: EventFields = {
    title: update.title,
    category: update.category,
    kind: update.kind,
    start: update.start,
    end: update.end,
    repeat: update.repeat,
    ...(update.repeat.type === 'weekly' ? { startDate: date } : {}),
    ...(update.endDate ?? event.endDate
      ? { endDate: (update.endDate ?? event.endDate) as string }
      : {}),
    ...(update.note ? { note: update.note } : {}),
    ...(update.essential !== undefined ? { essential: update.essential } : {}),
  }

  const stored = toStored(ownerId, fields, 'user')
  const clash = await findClash(ownerId, normalizeLegacyEvent(stored as any), _id)
  if (clash) throw new ApiError(409, `That time clashes with ${describeEvent(clash)}`)

  const firstDay = event.repeat.type === 'once' ? event.repeat.date : event.startDate
  const wholeSeries = event.repeat.type === 'once' || (firstDay !== undefined && date <= firstDay)

  if (wholeSeries) {
    await db.collection(COMPLETIONS).deleteMany({ ownerId, eventId: id })
    await db.collection(EVENTS).deleteOne({ _id, ownerId })
  } else {
    await db.collection(EVENTS).updateOne(
      { _id, ownerId },
      {
        $set: {
          endDate: dayBefore(date),
          exceptions: event.exceptions.filter((entry) => entry.date < date),
          updatedAt: new Date(),
        },
      }
    )
  }

  const result = await db.collection(EVENTS).insertOne(stored)
  return serializeEvent(normalizeLegacyEvent({ ...stored, _id: result.insertedId } as any))
}

/**
 * Deletes an event, the whole series or part of it.
 *
 * `scope: 'this'` hides the event on one date (a skip exception) rather than
 * dropping the series; `scope: 'future'` ends the series the day before `date`;
 * anything else removes the event and its completions.
 */
export async function deleteEvent(
  ownerId: string,
  id: string,
  options: { scope?: 'this' | 'future'; date?: string } = {}
): Promise<{ deleted: boolean; skipped: boolean; truncated: boolean }> {
  const db = await getDb()
  const { _id, event } = await loadOwnedEvent(db, ownerId, id)

  const date = options.date
  const hasDate = Boolean(date && isDate(date))

  if (options.scope === 'this') {
    if (!hasDate) throw new ApiError(400, 'A date is required to skip one day')
    if (!appliesOn(event, date!) || skippedOn(event, date!)) {
      throw new ApiError(400, 'That event does not occur on that date')
    }

    const exceptions = [
      ...event.exceptions.filter((entry) => entry.date !== date),
      { date: date!, skip: true },
    ]
    await db
      .collection(EVENTS)
      .updateOne({ _id, ownerId }, { $set: { exceptions, updatedAt: new Date() } })
    return { deleted: false, skipped: true, truncated: false }
  }

  if (hasDate) {
    const firstDay = event.repeat.type === 'once' ? event.repeat.date : event.startDate
    const wholeSeries = event.repeat.type === 'once' || (firstDay !== undefined && date! <= firstDay)
    if (!wholeSeries) {
      await db.collection(EVENTS).updateOne(
        { _id, ownerId },
        {
          $set: {
            endDate: dayBefore(date!),
            exceptions: event.exceptions.filter((entry) => entry.date < date!),
            updatedAt: new Date(),
          },
        }
      )
      return { deleted: false, skipped: false, truncated: true }
    }
  }

  await db.collection(COMPLETIONS).deleteMany({ ownerId, eventId: id })
  await db.collection(EVENTS).deleteOne({ _id, ownerId })
  return { deleted: true, skipped: false, truncated: false }
}

/**
 * Ticks a block on a date, or clears it.
 *
 * The event must belong to the owner *and* actually occur on that date, so a
 * stale or guessed id cannot be used to write a completion. `done: false` is a
 * plain delete, which is what makes the toggle idempotent.
 */
export async function setCompletion(
  ownerId: string,
  input: CompletionToggle
): Promise<{ done: boolean }> {
  const db = await getDb()
  const { event } = await loadOwnedEvent(db, ownerId, input.eventId)

  if (!appliesOn(event, input.date) || skippedOn(event, input.date)) {
    throw new ApiError(400, 'That event does not occur on that date')
  }

  if (input.done) {
    await db.collection(COMPLETIONS).updateOne(
      { ownerId, date: input.date, eventId: input.eventId },
      { $setOnInsert: { doneAt: new Date() } },
      { upsert: true }
    )
  } else {
    await db
      .collection(COMPLETIONS)
      .deleteOne({ ownerId, date: input.date, eventId: input.eventId })
  }

  return { done: input.done }
}

/** Completions for a set of dates, grouped by date. */
async function completionsByDate(
  db: Db,
  ownerId: string,
  from: string,
  to: string
): Promise<Map<string, Set<string>>> {
  const rows = await db
    .collection(COMPLETIONS)
    .find({ ownerId, date: { $gte: from, $lte: to } })
    .toArray()

  const byDate = new Map<string, Set<string>>()
  for (const row of rows) {
    const ids = byDate.get(String(row.date)) ?? new Set<string>()
    ids.add(String(row.eventId))
    byDate.set(String(row.date), ids)
  }
  return byDate
}

function withDone(blocks: DayBlock[], done: Iterable<string>): BlockView[] {
  const ids = new Set(done)
  return blocks.map((block) => ({ ...block, done: ids.has(block.eventId) }))
}

/**
 * The earliest date the streak may count back to.
 *
 * A weekly event with no start date has no first day of its own, so its
 * creation date stands in: the streak never reaches back before the plan the
 * account actually made.
 */
function streakFloor(events: EventDoc[], timezone: string): string | null {
  let floor: string | null = null
  for (const event of events) {
    let day: string | null = null
    if (event.repeat.type === 'once') day = event.repeat.date
    else if (event.startDate) day = event.startDate
    else if (event.createdAt) day = todayIn(timezone, event.createdAt)

    if (day && (!floor || day < floor)) floor = day
  }
  return floor
}

/**
 * How many days in a row the owner finished every essential block.
 *
 * Read from the resolver and the completions store, never from the client's
 * clock: the run is walked to the most recent day, neutral days (nothing
 * essential) are stepped over, and the first unfinished essential day ends it.
 * A day still in progress is not held against the streak.
 */
export async function computeStreak(
  ownerId: string,
  timezone: string,
  today: string,
  events?: EventDoc[]
): Promise<number> {
  const db = await getDb()
  const all =
    events ?? normalizeEvents((await db.collection(EVENTS).find({ ownerId }).toArray()) as any)

  const floor = streakFloor(all, timezone)
  if (!floor) return 0

  const from = addDays(today, -(STREAK_LOOKBACK_DAYS - 1)) > floor
    ? addDays(today, -(STREAK_LOOKBACK_DAYS - 1))
    : floor

  const doneByDate = await completionsByDate(db, ownerId, from, today)

  const days: StreakDay[] = []
  for (let date = today; date >= from; date = addDays(date, -1)) {
    const progress = essentialProgress(resolveDay(all, date), doneByDate.get(date) ?? [])
    days.push({ date, ...progress })
  }

  // Today is not over yet, so an unfinished essential today neither counts nor
  // breaks the run — the day only starts counting once it is complete.
  const todayRow = days[0]
  const startAt = todayRow && todayRow.essential > 0 && todayRow.done < todayRow.essential ? 1 : 0
  return streakFrom(days.slice(startAt), floor)
}

/** The blocks a date shows, with each one's ticked state and the streak. */
export async function getDayView(ownerId: string, date: string): Promise<DayView> {
  const db = await getDb()
  const timezone = await timezoneFor(ownerId)
  const today = todayIn(timezone)

  const events = normalizeEvents((await db.collection(EVENTS).find({ ownerId }).toArray()) as any)
  const doneByDate = await completionsByDate(db, ownerId, date, date)

  return {
    timezone,
    today,
    date,
    blocks: withDone(resolveDay(events, date), doneByDate.get(date) ?? []),
    streak: await computeStreak(ownerId, timezone, today, events),
  }
}

/** Seven days from Monday of the week `anchor` falls in. */
export async function getWeekView(ownerId: string, anchor: string): Promise<WeekView> {
  const db = await getDb()
  const timezone = await timezoneFor(ownerId)
  const today = todayIn(timezone)

  const events = normalizeEvents((await db.collection(EVENTS).find({ ownerId }).toArray()) as any)
  const weekStart = weekStartOf(anchor)
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const doneByDate = await completionsByDate(db, ownerId, dates[0], dates[6])

  return {
    timezone,
    today,
    weekStart,
    days: dates.map((date) => ({
      date,
      blocks: withDone(resolveDay(events, date), doneByDate.get(date) ?? []),
    })),
    streak: await computeStreak(ownerId, timezone, today, events),
  }
}
