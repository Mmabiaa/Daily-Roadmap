import { test } from 'node:test'
import assert from 'node:assert/strict'

import { newPinProblem, NEW_PIN_PATTERN } from './pin.ts'

test('accepts 6, 7 and 8 digit PINs', () => {
  for (const pin of ['482915', '4829153', '48291537']) {
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

test('a PIN that is a single repeated digit is rejected', () => {
  for (const pin of ['111111', '000000', '7777777', '22222222']) {
    assert.match(newPinProblem(pin) ?? '', /repeated/, `expected ${pin} to be rejected`)
  }
})

test('ascending and descending runs are rejected', () => {
  for (const pin of ['123456', '234567', '345678', '456789', '654321', '987654']) {
    assert.match(newPinProblem(pin) ?? '', /consecutive/, `expected ${pin} to be rejected`)
  }
})

test('a short common PIN is rejected', () => {
  for (const pin of ['121212', '112233', '123123']) {
    assert.match(newPinProblem(pin) ?? '', /too common/, `expected ${pin} to be rejected`)
  }
})

test('a PIN that is neither repeated nor sequential is accepted', () => {
  for (const pin of ['482915', '739184', '910283', '48291537', '504821']) {
    assert.equal(newPinProblem(pin), null, `expected ${pin} to be accepted`)
  }
})

test('weak-PIN checks never accept something the length rule rejects', () => {
  for (const pin of ['1234', '123456789', 'abcdef']) {
    assert.notEqual(newPinProblem(pin), null, `expected ${pin} to be rejected`)
  }
})
