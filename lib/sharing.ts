/**
 * Sharing a class timetable with classmates.
 *
 * The unit is a *snapshot*: one student's class events are copied out at the
 * moment they ask for a code, and only those are stored. Later edits to their
 * own plan are never reflected in the share, and nothing outside the `class`
 * category is ever copied — so someone importing a code gets the timetable and
 * cannot see, or reach, the personal plan behind it.
 */

import { randomInt } from 'node:crypto'

import { ApiError } from './errors.ts'
import { ensureIndexes, getDb } from './mongodb.ts'
import { normalizeLegacyEvent } from './resolver.ts'
import { importBlocks, type BulkBlock } from './schedule-service.ts'

const SHARES = 'timetable_shares'

/**
 * The alphabet a code is drawn from. The letters and digits that read the same
 * upside down or by ear are left out, so a code can be said out loud in a
 * lecture hall without a "was that a zero or an O?".
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6
/** How many times a collision is retried before giving up. */
const CODE_ATTEMPTS = 5

function newCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

/** A stored class as a shareable block, or nothing when it is not a weekly class. */
function shareBlockOf(raw: Record<string, unknown>): BulkBlock[] {
  const event = normalizeLegacyEvent(raw)
  // A one-off class cannot be handed on as a weekly timetable.
  if (event.repeat.type !== 'weekly') return []

  return [
    {
      title: event.title,
      category: 'class',
      kind: 'fixed',
      start: event.start,
      end: event.end,
      repeat: { type: 'weekly', days: event.repeat.days },
      essential: false,
    },
  ]
}

/** Makes a code for the account's current class timetable. */
export async function createShare(
  ownerId: string,
  label?: string
): Promise<{ code: string; classes: number }> {
  const db = await getDb()
  await ensureIndexes()

  const rows = await db.collection('events').find({ ownerId, category: 'class' }).toArray()
  const blocks = rows.flatMap((row) => shareBlockOf(row as Record<string, unknown>))
  if (blocks.length === 0) {
    throw new ApiError(400, 'You have no classes to share yet. Add your timetable first.')
  }

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = newCode()
    if (await db.collection(SHARES).findOne({ code }, { projection: { _id: 1 } })) continue

    await db.collection(SHARES).insertOne({
      code,
      ownerId,
      ...(label ? { label } : {}),
      blocks,
      createdAt: new Date(),
    })
    return { code, classes: blocks.length }
  }

  throw new ApiError(500, 'Could not make a share code. Please try again.')
}

/** Copies a shared timetable onto the account, replacing its own classes. */
export async function importShare(ownerId: string, code: string): Promise<{ created: number }> {
  const db = await getDb()
  await ensureIndexes()

  const share = await db.collection(SHARES).findOne({ code })
  if (!share) throw new ApiError(404, 'That code was not found. Check it and try again.')

  const blocks = Array.isArray(share.blocks) ? (share.blocks as BulkBlock[]) : []
  const { created } = await importBlocks(ownerId, blocks, { replaceCategory: 'class' })
  return { created }
}
