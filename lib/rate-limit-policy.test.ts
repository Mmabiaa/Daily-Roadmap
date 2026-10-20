import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FAILURE_WINDOW_MS,
  MAX_FAILURES,
  accountKey,
  ipKey,
  isWindowExpired,
  lockDurationMs,
  retryAfterSeconds,
  SCOPE_CAP_MS,
} from './rate-limit-policy.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

test('nothing is locked below the failure threshold', () => {
  for (const failures of [0, 1, 2, 3, 4]) {
    assert.equal(lockDurationMs(failures, 'account'), 0)
    assert.equal(lockDurationMs(failures, 'ip'), 0)
  }
})

test('the account ladder is 1m, 5m, 15m then an hour', () => {
  assert.equal(MAX_FAILURES, 5)
  assert.equal(lockDurationMs(5, 'account'), 1 * MINUTE)
  assert.equal(lockDurationMs(6, 'account'), 5 * MINUTE)
  assert.equal(lockDurationMs(7, 'account'), 15 * MINUTE)
  assert.equal(lockDurationMs(8, 'account'), 1 * HOUR)
})

test('an account is never locked for longer than an hour', () => {
  for (const failures of [9, 12, 20, 200]) {
    assert.equal(lockDurationMs(failures, 'account'), 1 * HOUR, `failures=${failures}`)
  }
  assert.equal(SCOPE_CAP_MS.account, 1 * HOUR)
})

test('an IP lock keeps growing, but never past a day', () => {
  assert.equal(lockDurationMs(9, 'ip'), 2 * HOUR)
  assert.equal(lockDurationMs(10, 'ip'), 4 * HOUR)
  assert.equal(lockDurationMs(11, 'ip'), 8 * HOUR)
  assert.equal(lockDurationMs(12, 'ip'), 16 * HOUR)
  assert.equal(lockDurationMs(13, 'ip'), 24 * HOUR)
  for (const failures of [14, 30, 500]) {
    assert.equal(lockDurationMs(failures, 'ip'), 24 * HOUR, `failures=${failures}`)
  }
  assert.equal(SCOPE_CAP_MS.ip, 24 * HOUR)
})

test('an IP is allowed to be locked longer than the account it is attacking', () => {
  assert.ok(lockDurationMs(12, 'ip') > lockDurationMs(12, 'account'))
})

test('the counting window goes stale after fifteen minutes', () => {
  const now = new Date('2026-01-01T12:00:00Z')
  assert.equal(isWindowExpired(null, now), true)
  assert.equal(isWindowExpired(undefined, now), true)
  assert.equal(isWindowExpired(new Date(now.getTime() - FAILURE_WINDOW_MS + 1), now), false)
  assert.equal(isWindowExpired(new Date(now.getTime() - FAILURE_WINDOW_MS), now), true)
})

test('the account bucket ignores case and surrounding space', () => {
  assert.equal(accountKey('Alice'), accountKey('  alice  '))
  assert.equal(accountKey('alice'), 'acct:alice')
})

test('the IP bucket is hashed, stable, and unique per address', () => {
  const key = ipKey('203.0.113.7')
  assert.match(key, /^ip:[0-9a-f]{64}$/)
  assert.equal(key, ipKey('203.0.113.7'))
  assert.notEqual(key, ipKey('203.0.113.8'))
  assert.ok(!key.includes('203.0.113.7'))
})

test('Retry-After is a whole number of seconds and never zero', () => {
  const now = new Date('2026-01-01T12:00:00Z')
  assert.equal(retryAfterSeconds(new Date(now.getTime() + 60_000), now), 60)
  assert.equal(retryAfterSeconds(new Date(now.getTime() + 1500), now), 2)
  assert.equal(retryAfterSeconds(now, now), 1)
  assert.equal(retryAfterSeconds(new Date(now.getTime() - 5_000), now), 1)
})
