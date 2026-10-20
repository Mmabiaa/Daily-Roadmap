import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  FAILURE_WINDOW_MS,
  MAX_FAILURES,
  MAX_IP_FAILURES,
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

test('an IP lock is shared by the whole address, so it needs many failures', () => {
  for (const failures of [5, 10, MAX_IP_FAILURES - 1]) {
    assert.equal(lockDurationMs(failures, 'ip'), 0, `failures=${failures}`)
  }
  assert.equal(lockDurationMs(MAX_IP_FAILURES, 'ip'), 1 * HOUR)
  for (const failures of [31, 60, 500]) {
    assert.equal(lockDurationMs(failures, 'ip'), 1 * HOUR, `failures=${failures}`)
  }
})

test('one careless account locks itself without locking its whole network', () => {
  // Five wrong PINs: the account waits a minute, the shared address is untouched.
  assert.equal(lockDurationMs(MAX_FAILURES, 'account'), 1 * MINUTE)
  assert.equal(lockDurationMs(MAX_FAILURES, 'ip'), 0)
  assert.ok(MAX_IP_FAILURES > MAX_FAILURES * 4)
})

test('no scope is ever locked for longer than an hour', () => {
  assert.equal(SCOPE_CAP_MS.account, 1 * HOUR)
  assert.equal(SCOPE_CAP_MS.ip, 1 * HOUR)
  for (const failures of [9, 12, 30, 60, 500]) {
    assert.equal(lockDurationMs(failures, 'account'), 1 * HOUR, `account failures=${failures}`)
  }
  for (const failures of [MAX_IP_FAILURES, 60, 500]) {
    assert.equal(lockDurationMs(failures, 'ip'), 1 * HOUR, `ip failures=${failures}`)
  }
})

test('the account and IP bucket keys never collide', () => {
  assert.notEqual(accountKey('203.0.113.7'), ipKey('203.0.113.7'))
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
