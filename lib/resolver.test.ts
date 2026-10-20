import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { EventDoc } from './models.ts'
import { weekdayOf } from './schedule-time.ts'
import {
  dayStatus,
  essentialProgress,
  normalizeEvents,
  normalizeLegacyEvent,
  resolveDay,
  streakFrom,
  type DayBlock,
} from './resolver.ts'

/** A stored v2 event, with the fields the tests do not care about filled in. */
function event(over: Partial<EventDoc> = {}): EventDoc {
  return {
    _id: 'e1',
    ownerId: 'u1',
    title: 'Block',
    category: 'class',
    kind: 'fixed',
    start: '09:00',
    end: '10:00',
    repeat: { type: 'weekly', days: ['Mon'] },
    essential: false,
    exceptions: [],
    source: 'user',
    ...over,
  }
}

/** A resolved block, for the pieces that take blocks rather than events. */
function block(over: Partial<DayBlock> = {}): DayBlock {
  return {
    eventId: 'e1',
    title: 'Block',
    category: 'class',
    kind: 'fixed',
    start: '09:00',
    end: '10:00',
    essential: false,
    source: 'user',
    ...over,
  }
}

// A Monday, and the Tuesday that follows it.
const MONDAY = '2026-10-19'
const TUESDAY = '2026-10-20'

test('weekdayOf reads the calendar weekday off a date', () => {
  assert.equal(weekdayOf(MONDAY), 'Mon')
  assert.equal(weekdayOf(TUESDAY), 'Tue')
  assert.equal(weekdayOf('2026-10-25'), 'Sun')
})

test('a weekly event shows only on its weekdays', () => {
  const events = [event({ repeat: { type: 'weekly', days: ['Mon'] } })]
  assert.equal(resolveDay(events, MONDAY).length, 1)
  assert.deepEqual(resolveDay(events, TUESDAY), [])
})

test('a weekly event can cover several weekdays', () => {
  const events = [event({ repeat: { type: 'weekly', days: ['Mon', 'Tue'] } })]
  assert.equal(resolveDay(events, MONDAY).length, 1)
  assert.equal(resolveDay(events, TUESDAY).length, 1)
})

test('a one-off event shows only on its own date', () => {
  const events = [event({ repeat: { type: 'once', date: TUESDAY } })]
  assert.deepEqual(resolveDay(events, MONDAY), [])
  assert.equal(resolveDay(events, TUESDAY).length, 1)
})

test('a one-off event ignores the weekday rule', () => {
  // A Wednesday date, but the event is pinned to Monday: the date wins.
  const events = [event({ repeat: { type: 'once', date: MONDAY } })]
  assert.equal(resolveDay(events, '2026-10-21').length, 0)
  assert.equal(resolveDay(events, MONDAY).length, 1)
})

test('startDate and endDate bound a weekly series on both sides', () => {
  const events = [
    event({ startDate: '2026-10-19', endDate: '2026-10-19', repeat: { type: 'weekly', days: ['Mon'] } }),
  ]
  assert.equal(resolveDay(events, MONDAY).length, 1)
  // The next Monday is past the end date.
  assert.equal(resolveDay(events, '2026-10-26').length, 0)
  // And the Monday before is before the start date.
  assert.equal(resolveDay(events, '2026-10-12').length, 0)
})

test('a skip exception hides the event on that date only', () => {
  const events = [
    event({ repeat: { type: 'weekly', days: ['Mon'] }, exceptions: [{ date: MONDAY, skip: true }] }),
  ]
  assert.deepEqual(resolveDay(events, MONDAY), [])
  assert.equal(resolveDay(events, '2026-10-26').length, 1)
})

test('an override exception replaces times, title, note and essential', () => {
  const events = [
    event({
      title: 'Class',
      essential: true,
      start: '09:00',
      end: '10:00',
      exceptions: [
        { date: MONDAY, start: '11:00', end: '12:30', title: 'Class (moved)', essential: false, note: 'Room 4' },
      ],
    }),
  ]
  const [resolved] = resolveDay(events, MONDAY)
  assert.equal(resolved.title, 'Class (moved)')
  assert.equal(resolved.start, '11:00')
  assert.equal(resolved.end, '12:30')
  assert.equal(resolved.essential, false)
  assert.equal(resolved.note, 'Room 4')
})

test('an override that sets only a start keeps the stored end', () => {
  const events = [event({ start: '09:00', end: '10:00', exceptions: [{ date: MONDAY, start: '09:30' }] })]
  const [resolved] = resolveDay(events, MONDAY)
  assert.equal(resolved.start, '09:30')
  assert.equal(resolved.end, '10:00')
})

test('each resolved block carries the id of the event it came from', () => {
  const events = [event({ _id: 'abc123' })]
  assert.equal(resolveDay(events, MONDAY)[0].eventId, 'abc123')
})

test('blocks are sorted by start time', () => {
  const events = [
    event({ _id: 'late', start: '15:00', end: '16:00' }),
    event({ _id: 'early', start: '07:00', end: '08:00' }),
    event({ _id: 'mid', start: '11:00', end: '12:00' }),
  ]
  assert.deepEqual(
    resolveDay(events, MONDAY).map((b) => b.start),
    ['07:00', '11:00', '15:00']
  )
})

test('blocks with the same start time keep a stable order: createdAt, then id', () => {
  const events = [
    event({ _id: 'b', start: '09:00', createdAt: new Date('2026-01-02T00:00:00Z') }),
    event({ _id: 'c', start: '09:00', createdAt: new Date('2026-01-01T00:00:00Z') }),
    event({ _id: 'a', start: '09:00', createdAt: new Date('2026-01-01T00:00:00Z') }),
  ]
  assert.deepEqual(
    resolveDay(events, MONDAY).map((b) => b.eventId),
    ['a', 'c', 'b']
  )
})

test('a legacy row is read as a weekly event with its old end', () => {
  const legacy = { _id: 'l1', userId: 'u1', day: 'Mon', time: '09:00', title: 'Old', category: 'class', essential: true }
  const [doc] = normalizeEvents([legacy])
  assert.equal(doc.ownerId, 'u1')
  assert.equal(doc.start, '09:00')
  assert.deepEqual(doc.repeat, { type: 'weekly', days: ['Mon'] })
  assert.equal(doc.kind, 'fixed')
  assert.equal(doc.essential, true)
})

test('a legacy row takes its end from the next block, and the last from LAST_WAKE', () => {
  const docs = [
    { _id: 'l1', userId: 'u1', day: 'Mon', time: '09:00', title: 'A', category: 'study' },
    { _id: 'l2', userId: 'u1', day: 'Mon', time: '11:00', title: 'B', category: 'study' },
    { _id: 'l3', userId: 'u1', day: 'Mon', time: '22:00', title: 'Lights out', category: 'sleep' },
  ]
  assert.deepEqual(
    normalizeEvents(docs).map((d) => d.end),
    // 22:00 runs into the next morning, ending at the old wake time.
    ['11:00', '22:00', '05:30']
  )
})

test('a legacy row is mapped from its category: class is fixed, the rest move', () => {
  const [asClass] = normalizeEvents([{ day: 'Mon', time: '08:00', title: 'C', category: 'class' }])
  const [asStudy] = normalizeEvents([{ day: 'Mon', time: '08:00', title: 'S', category: 'study' }])
  assert.equal(asClass.kind, 'fixed')
  assert.equal(asStudy.kind, 'flexible')
})

test('normalizeLegacyEvent leaves an already-stored row alone', () => {
  const stored = event({ _id: 'e9' })
  assert.equal(normalizeLegacyEvent(stored as any).start, '09:00')
  assert.equal(normalizeLegacyEvent(stored as any).kind, 'fixed')
})

test('dayStatus finds the running block, the next one and the minutes left', () => {
  const blocks = [block({ start: '09:00', end: '10:00' }), block({ eventId: 'e2', start: '11:00', end: '12:00' })]
  const status = dayStatus(blocks, 9 * 60 + 30)
  assert.equal(status.current?.eventId, 'e1')
  assert.equal(status.next?.eventId, 'e2')
  assert.equal(status.minutesLeft, 30)
})

test('dayStatus reports nothing current between blocks', () => {
  const blocks = [block({ start: '09:00', end: '10:00' }), block({ eventId: 'e2', start: '11:00', end: '12:00' })]
  const status = dayStatus(blocks, 10 * 60 + 30)
  assert.equal(status.current, null)
  assert.equal(status.minutesLeft, null)
  assert.equal(status.next?.eventId, 'e2')
})

test('dayStatus lets a block running past midnight stay current the next morning', () => {
  // Sorted as the resolver returns them: the early block, then the late one.
  const blocks = [block({ eventId: 'e2', start: '05:30', end: '06:00' }), block({ start: '22:00', end: '05:30' })]
  const status = dayStatus(blocks, 2 * 60)
  assert.equal(status.current?.eventId, 'e1')
  // 02:00 to 05:30 is three and a half hours.
  assert.equal(status.minutesLeft, 210)
  assert.equal(status.next?.eventId, 'e2')
})

test('dayStatus counts down from an evening start to the early end', () => {
  const blocks = [block({ start: '22:00', end: '05:30' })]
  // 23:20 to 05:30 is 370 minutes.
  assert.equal(dayStatus(blocks, 23 * 60 + 20).minutesLeft, 370)
})

test('dayStatus never treats a zero-length block as running', () => {
  const blocks = [block({ start: '09:00', end: '09:00' })]
  assert.equal(dayStatus(blocks, 9 * 60).current, null)
})

test('dayStatus picks the latest-starting block when several overlap', () => {
  // A fixed class and a flexible block on top of it, both starting at 09:00.
  const blocks = [
    block({ eventId: 'class', start: '09:00', end: '10:00' }),
    block({ eventId: 'extra', start: '09:00', end: '11:00', kind: 'flexible' }),
  ]
  const status = dayStatus(blocks, 9 * 60 + 30)
  // Equal starts: the later one in the sorted list wins, deterministically.
  assert.equal(status.current?.eventId, 'extra')
  assert.equal(status.minutesLeft, 90)
})

test('dayStatus prefers a later start over an earlier one still running', () => {
  const blocks = [block({ eventId: 'long', start: '08:00', end: '12:00' }), block({ eventId: 'short', start: '09:00', end: '10:00' })]
  assert.equal(dayStatus(blocks, 9 * 60 + 30).current?.eventId, 'short')
})

test('essentialProgress counts only essential blocks that are ticked', () => {
  const blocks = [
    block({ eventId: 'a', essential: true }),
    block({ eventId: 'b', essential: true }),
    block({ eventId: 'c', essential: false }),
  ]
  assert.deepEqual(essentialProgress(blocks, ['a', 'c']), { essential: 2, done: 1 })
  assert.deepEqual(essentialProgress(blocks, []), { essential: 2, done: 0 })
})

test('streakFrom is zero for a brand-new account with nothing essential', () => {
  assert.equal(streakFrom([]), 0)
  assert.equal(
    streakFrom([
      { date: TUESDAY, essential: 0, done: 0 },
      { date: MONDAY, essential: 0, done: 0 },
    ]),
    0
  )
})

test('streakFrom skips a neutral day without breaking the run', () => {
  assert.equal(
    streakFrom([
      { date: '2026-10-21', essential: 3, done: 3 },
      { date: TUESDAY, essential: 0, done: 0 },
      { date: MONDAY, essential: 2, done: 2 },
    ]),
    2
  )
})

test('streakFrom resets on a missed essential day', () => {
  assert.equal(
    streakFrom([
      { date: '2026-10-21', essential: 2, done: 2 },
      { date: TUESDAY, essential: 2, done: 1 },
      { date: MONDAY, essential: 2, done: 2 },
    ]),
    1
  )
})

test('streakFrom counts a fully ticked day and stops at an unfinished one', () => {
  assert.equal(
    streakFrom([
      { date: '2026-10-21', essential: 1, done: 1 },
      { date: TUESDAY, essential: 1, done: 1 },
      { date: MONDAY, essential: 1, done: 0 },
    ]),
    2
  )
})

test('streakFrom never looks back before the account had its first event', () => {
  assert.equal(
    streakFrom(
      [
        { date: '2026-10-21', essential: 1, done: 1 },
        { date: TUESDAY, essential: 1, done: 1 },
        { date: MONDAY, essential: 1, done: 1 },
      ],
      TUESDAY
    ),
    2
  )
})

test('streakFrom stops at the floor even when older days were complete', () => {
  assert.equal(
    streakFrom(
      [
        { date: TUESDAY, essential: 1, done: 1 },
        { date: MONDAY, essential: 1, done: 1 },
      ],
      TUESDAY
    ),
    1
  )
})
