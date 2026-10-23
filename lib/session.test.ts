import { test } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

import { assertSessionSecret, generateToken, tokenVersionOf, verifyToken } from './session.ts'

// A fixed secret for this process, so a token we mint by hand below is signed
// with exactly the key `verifyToken` will use. Must be set before the first
// call, because the module caches the secret the first time it needs it.
const TEST_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-session-tests'
process.env.JWT_SECRET = TEST_SECRET

test('a generated token reads back with the same user and version', () => {
  const token = generateToken('507f1f77bcf86cd799439011', 3)
  assert.deepEqual(verifyToken(token), { userId: '507f1f77bcf86cd799439011', tv: 3 })
})

test('a token minted before token versions existed counts as version 0', () => {
  // The shape shipped by the previous release: a `userId`, no `tv`.
  const legacy = jwt.sign({ userId: 'legacy-user' }, TEST_SECRET, { expiresIn: '7d' })
  assert.deepEqual(verifyToken(legacy), { userId: 'legacy-user', tv: 0 })
})

test('a token signed with another secret is refused', () => {
  const forged = jwt.sign({ userId: 'attacker', tv: 99 }, 'not-the-real-secret', {
    expiresIn: '7d',
  })
  assert.equal(verifyToken(forged), null)
})

test('nonsense and non-string payloads are refused rather than thrown', () => {
  for (const token of ['', 'not.a.token', 'a.b.c']) {
    assert.equal(verifyToken(token), null, `expected ${JSON.stringify(token)} to be refused`)
  }
})

test('an expired token is refused', () => {
  const stale = jwt.sign({ userId: 'old', tv: 0 }, TEST_SECRET, { expiresIn: '-1s' })
  assert.equal(verifyToken(stale), null)
})

test('tokenVersionOf reads the stored version and defaults to 0', () => {
  assert.equal(tokenVersionOf({ tokenVersion: 4 }), 4)
  assert.equal(tokenVersionOf({ tokenVersion: 0 }), 0)
  assert.equal(tokenVersionOf({}), 0)
  assert.equal(tokenVersionOf(null), 0)
  assert.equal(tokenVersionOf(undefined), 0)
  assert.equal(tokenVersionOf({ tokenVersion: '3' }), 0)
})

test('a production process without JWT_SECRET refuses to start', () => {
  assert.throws(() => assertSessionSecret({ NODE_ENV: 'production' }), /JWT_SECRET/)
})

test('a production process with JWT_SECRET starts', () => {
  assert.doesNotThrow(() =>
    assertSessionSecret({ NODE_ENV: 'production', JWT_SECRET: 'a-real-secret' })
  )
})

test('development without JWT_SECRET warns instead of throwing', () => {
  assert.doesNotThrow(() => assertSessionSecret({ NODE_ENV: 'development' }))
})
