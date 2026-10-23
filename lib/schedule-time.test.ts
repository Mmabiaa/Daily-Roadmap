import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isDate } from './schedule-time.ts'

test('isDate accepts a real calendar date', () => {
  assert.equal(isDate('2026-10-19'), true)
  assert.equal(isDate('2026-01-01'), true)
  assert.equal(isDate('2026-12-31'), true)
  // A leap day that really exists.
  assert.equal(isDate('2024-02-29'), true)
})

test('isDate rejects a date the calendar does not have', () => {
  // February never has 30 days, so `Date.UTC` would roll this into 2 March.
  assert.equal(isDate('2026-02-30'), false)
  // There is no month 13.
  assert.equal(isDate('2026-13-01'), false)
  // There is no month 0.
  assert.equal(isDate('2026-00-10'), false)
})

test('isDate rejects a leap day in a year that has none', () => {
  assert.equal(isDate('2026-02-29'), false)
  assert.equal(isDate('1900-02-29'), false)
})

test('isDate rejects anything that is not exactly YYYY-MM-DD', () => {
  assert.equal(isDate('2026-1-01'), false)
  assert.equal(isDate('26-01-01'), false)
  assert.equal(isDate('2026/01/01'), false)
  assert.equal(isDate('2026-01-01T00:00:00Z'), false)
  assert.equal(isDate(''), false)
  assert.equal(isDate(20260101), false)
  assert.equal(isDate(null), false)
  assert.equal(isDate(undefined), false)
})

test('isDate reads years below 100 without the 1900 fold', () => {
  // `new Date(Date.UTC(26, 0, 1))` is 1926; the round-trip must still accept 0026.
  assert.equal(isDate('0026-01-01'), true)
  assert.equal(isDate('0026-02-30'), false)
})
