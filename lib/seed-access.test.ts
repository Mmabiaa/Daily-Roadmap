import { test } from 'node:test'
import assert from 'node:assert/strict'

import { checkSeedAccess } from './seed-access.ts'

test('no secret configured disables seeding in production', () => {
  assert.equal(
    checkSeedAccess({ providedKey: 'anything', configuredSecret: undefined, isProduction: true }),
    'disabled'
  )
})

test('no secret configured still allows seeding in development', () => {
  assert.equal(
    checkSeedAccess({ providedKey: null, configuredSecret: undefined, isProduction: false }),
    'ok'
  )
})

test('the correct key is accepted', () => {
  assert.equal(
    checkSeedAccess({ providedKey: 's3cret', configuredSecret: 's3cret', isProduction: true }),
    'ok'
  )
})

test('a missing key is rejected when a secret is configured', () => {
  assert.equal(
    checkSeedAccess({ providedKey: null, configuredSecret: 's3cret', isProduction: true }),
    'forbidden'
  )
})

test('a wrong key is rejected', () => {
  assert.equal(
    checkSeedAccess({ providedKey: 'nope', configuredSecret: 's3cret', isProduction: true }),
    'forbidden'
  )
})

test('a wrong key of a different length is rejected rather than throwing', () => {
  assert.equal(
    checkSeedAccess({ providedKey: 'a-much-longer-guess', configuredSecret: 's3cret', isProduction: true }),
    'forbidden'
  )
})

test('an empty configured secret counts as unconfigured', () => {
  assert.equal(
    checkSeedAccess({ providedKey: '', configuredSecret: '', isProduction: true }),
    'disabled'
  )
})
