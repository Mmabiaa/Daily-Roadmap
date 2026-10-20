import { test } from 'node:test'
import assert from 'node:assert/strict'

import { EventInputSchema, EventUpdateSchema } from './models.ts'

/** A valid weekly event, so each test only states what it changes. */
function input(over: Record<string, unknown> = {}) {
  return {
    title: 'Study',
    category: 'study',
    kind: 'flexible',
    start: '09:00',
    end: '10:00',
    repeat: { type: 'weekly', days: ['Mon'] },
    ...over,
  }
}

test('an event with no length is refused', () => {
  assert.equal(EventInputSchema.safeParse(input({ end: '09:00' })).success, false)
})

test('a window that ends before it starts is refused', () => {
  const result = EventInputSchema.safeParse(
    input({ startDate: '2026-12-20', endDate: '2026-10-19' })
  )
  assert.equal(result.success, false)
})

test('a window that starts and ends on the same day is allowed', () => {
  const result = EventInputSchema.safeParse(
    input({ startDate: '2026-10-19', endDate: '2026-10-19' })
  )
  assert.equal(result.success, true)
})

test('a one-off event may not carry a date window', () => {
  const once = { type: 'once', date: '2026-10-19' }
  assert.equal(
    EventInputSchema.safeParse(input({ repeat: once, startDate: '2026-10-19' })).success,
    false
  )
  assert.equal(
    EventInputSchema.safeParse(input({ repeat: once, endDate: '2026-12-20' })).success,
    false
  )
  assert.equal(EventInputSchema.safeParse(input({ repeat: once })).success, true)
})

test('a weekly event lists each weekday at most once', () => {
  assert.equal(
    EventInputSchema.safeParse(input({ repeat: { type: 'weekly', days: ['Mon', 'Mon'] } })).success,
    false
  )
  assert.equal(
    EventInputSchema.safeParse(input({ repeat: { type: 'weekly', days: ['Mon', 'Tue'] } })).success,
    true
  )
})

test('exceptions sent by a client are dropped, not stored', () => {
  const result = EventInputSchema.safeParse(
    input({ exceptions: [{ date: '2026-10-19', skip: true }] })
  )
  assert.equal(result.success, true)
  assert.equal('exceptions' in (result as { data: object }).data, false)
})

test('the edit schema carries the same rules as create', () => {
  assert.equal(EventUpdateSchema.safeParse(input({ scope: 'this' })).success, true)
  assert.equal(
    EventUpdateSchema.safeParse(input({ scope: 'this', startDate: '2026-12-20', endDate: '2026-10-19' }))
      .success,
    false
  )
  const result = EventUpdateSchema.safeParse(
    input({ scope: 'this', exceptions: [{ date: '2026-10-19', skip: true }] })
  )
  assert.equal(result.success, true)
  assert.equal('exceptions' in (result as { data: object }).data, false)
})
