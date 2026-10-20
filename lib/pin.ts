/**
 * PIN rules.
 *
 * Sign-in still accepts the 4–8 digit PINs that older accounts already have,
 * so nobody is locked out of an existing account. Anything chosen *now* —
 * sign-up, a PIN reset, or the admin PIN created by the seed — must be 6–8
 * digits and must not be trivially guessable.
 */
export const NEW_PIN_PATTERN = /^\d{6,8}$/

export const NEW_PIN_RULE = 'PIN must be 6–8 digits'

/**
 * The PINs people reach for first. Not a security boundary on its own — the
 * sign-in limiter is — but it removes the worst choices at the point where the
 * owner still has a free choice.
 */
const COMMON_PINS = new Set([
  '000000', '111111', '222222', '333333', '444444', '555555',
  '666666', '777777', '888888', '999999',
  '123456', '654321', '112233', '121212', '212121', '123123', '321321',
  '696969', '420420', '789456', '159753', '147258', '102030', '246810',
  '135790', '1234567', '7654321', '12345678', '87654321',
  '0000000', '00000000', '1111111', '11111111',
])

/** True for runs like 345678 or 876543, which are as guessable as 123456. */
function isSequential(pin: string): boolean {
  const digits = [...pin].map(Number)
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1)
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1)
  return ascending || descending
}

/**
 * Why a newly chosen PIN is unacceptable, or `null` when it is fine.
 * Only used where a PIN is *chosen*; sign-in never rejects on strength.
 */
export function newPinProblem(pin: string): string | null {
  if (!NEW_PIN_PATTERN.test(pin)) return NEW_PIN_RULE
  if (new Set(pin).size === 1) return 'PIN cannot be a single digit repeated'
  if (isSequential(pin)) return 'PIN cannot be a run of consecutive digits'
  if (COMMON_PINS.has(pin)) return 'That PIN is too common — please choose another'
  return null
}
