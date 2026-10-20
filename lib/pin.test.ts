import { test } from 'node:test'
import assert from 'node:assert/strict'

import { NEW_PIN_PATTERN } from './pin.ts'

test('accepts 6, 7 and 8 digit PINs', () => {
  for (const pin of ['123456', '1234567', '12345678', '000000']) {
    assert.ok(NEW_PIN_PATTERN.test(pin), `expected ${pin} to be accepted`)
  }
})

test('rejects PINs shorter than 6 digits', () => {
  for (const pin of ['', '1', '1234', '12345']) {
    assert.equal(NEW_PIN_PATTERN.test(pin), false, `expected ${pin} to be rejected`)
  }
})

test('rejects PINs longer than 8 digits', () => {
  assert.equal(NEW_PIN_PATTERN.test('123456789'), false)
})

test('rejects anything that is not only digits', () => {
  for (const pin of ['12345a', 'abcdef', '12 3456', '12345678 ']) {
    assert.equal(NEW_PIN_PATTERN.test(pin), false, `expected ${pin} to be rejected`)
  }
})
