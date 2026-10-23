/**
 * Wall-clock time.
 *
 * Blocks are stored as the times a person reads off their own clock ("09:00 on
 * Monday"), so the only thing needed to turn "today" into a date is the zone
 * those times belong to. Phase 0 records the zone on the account and adds this
 * helper; the call sites move over in Phase 1.
 */

export const DEFAULT_TIME_ZONE = 'UTC'

/**
 * Zone names that are real IANA zones without the usual `Area/Location` shape.
 * Anything else with no `/` is either a continent with no city (`Europe`) or a
 * raw offset (`+01:00`), and `Intl` accepts some of those.
 */
const SINGLE_WORD_ZONES = new Set(['UTC', 'GMT', 'Zulu'])

/**
 * Whether the platform can resolve a zone name.
 *
 * Uses `Intl` itself rather than `Intl.supportedValuesOf`, which lists canonical
 * names only: real browsers report aliases such as `Asia/Calcutta`, and refusing
 * those would quietly move a user to UTC.
 *
 * Raw offsets are refused even though `Intl` accepts them, because an account
 * tracking an offset would silently drift by an hour at every daylight-saving
 * change — the exact bug the stored zone exists to prevent.
 */
export function isSupportedTimeZone(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const zone = value.trim()
  if (!zone || zone.length > 64) return false
  if (!zone.includes('/') && !SINGLE_WORD_ZONES.has(zone)) return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** The zone to store on an account: the one given if it is real, UTC otherwise. */
export function normalizeTimeZone(value: unknown): string {
  return isSupportedTimeZone(value) ? value.trim() : DEFAULT_TIME_ZONE
}

/**
 * The calendar date (`YYYY-MM-DD`) it is right now in a zone.
 *
 * Built from `formatToParts` rather than a locale's own formatting, so the
 * output is the same shape everywhere and cannot pick up a different calendar.
 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
