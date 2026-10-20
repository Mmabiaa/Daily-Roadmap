/**
 * PIN rules.
 *
 * Sign-in still accepts the 4–8 digit PINs that older accounts already have
 * (see `PIN_PATTERN` in `lib/models.ts`). Anything chosen *now* — sign-up, a PIN
 * reset, or the admin PIN created by the seed — must be 6–8 digits.
 */
export const NEW_PIN_PATTERN = /^\d{6,8}$/

export const NEW_PIN_RULE = 'PIN must be 6–8 digits'
