import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_TIME_ZONE,
  isSupportedTimeZone,
  normalizeTimeZone,
  todayIn,
} from './timezone.ts'

test('a zone the platform knows is accepted, aliases included', () => {
  for (const zone of ['UTC', 'Europe/London', 'Asia/Kolkata', 'Asia/Calcutta', 'America/New_York']) {
    assert.equal(isSupportedTimeZone(zone), true, `expected ${zone} to be accepted`)
  }
})

test('surrounding space is tolerated', () => {
  assert.equal(isSupportedTimeZone('  Europe/Paris  '), true)
})

test('nonsense and non-strings are refused', () => {
  for (const value of ['', '   ', 'Not/AZone', 'Europe', '+01:00', 'x'.repeat(65)]) {
    assert.equal(isSupportedTimeZone(value), false, `expected ${JSON.stringify(value)} to be refused`)
  }
  for (const value of [null, undefined, 42, {}, ['UTC']]) {
    assert.equal(isSupportedTimeZone(value), false)
  }
})

test('a zone that cannot be resolved falls back to UTC', () => {
  assert.equal(normalizeTimeZone(undefined), DEFAULT_TIME_ZONE)
  assert.equal(normalizeTimeZone('Not/AZone'), DEFAULT_TIME_ZONE)
  assert.equal(normalizeTimeZone('Europe/London'), 'Europe/London')
})

test('todayIn reads the date off the wall clock in that zone', () => {
  // 15:30 UTC is already the next day in Tokyo and still the same day in London.
  const instant = new Date('2026-10-20T15:30:00Z')
  assert.equal(todayIn('UTC', instant), '2026-10-20')
  assert.equal(todayIn('Europe/London', instant), '2026-10-20')
  assert.equal(todayIn('Asia/Tokyo', instant), '2026-10-21')
})

test('todayIn crosses the date line in both directions', () => {
  // 03:00 UTC on the 20th is still the 19th in Los Angeles and the 21st in Auckland.
  const instant = new Date('2026-10-20T03:00:00Z')
  assert.equal(todayIn('America/Los_Angeles', instant), '2026-10-19')
  assert.equal(todayIn('Pacific/Auckland', instant), '2026-10-20')
})

test('todayIn returns a padded ISO date, never a locale format', () => {
  const instant = new Date('2026-01-05T12:00:00Z')
  assert.match(todayIn('UTC', instant), /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(todayIn('UTC', instant), '2026-01-05')
})

test('todayIn falls back to UTC rather than throwing on a bad zone', () => {
  const instant = new Date('2026-10-20T23:30:00Z')
  assert.equal(todayIn('Not/AZone', instant), '2026-10-20')
})
