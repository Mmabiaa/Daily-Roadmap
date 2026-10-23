/**
 * Phase 1B migration: give the pre-1A event rows an owner and the v2 shape.
 *
 * Before Phase 1A the schedule was one global list. A row was a weekday, a
 * start time and a title, and it had no owner at all. Phase 1A made events
 * private to an account and gave each one an explicit end, so those rows are
 * now invisible to every read (all of them filter by `ownerId`) and unusable by
 * every write — they belong to no one.
 *
 * This claims them for one account and rewrites them into the v2 shape,
 * including the end each block used to borrow from the next block of its day,
 * which is the same computation `normalizeEvents` performs on the read path.
 *
 * Run it as a dry run first; nothing is written without `--apply`.
 *
 *   node --experimental-strip-types --env-file=.env.local \
 *     scripts/migrate-events-to-v2.ts --confirm-db daily-roadmap
 *
 *   node --experimental-strip-types --env-file=.env.local \
 *     scripts/migrate-events-to-v2.ts --confirm-db daily-roadmap --apply
 *
 * It is re-runnable: a row is only ever selected while it is unowned or still
 * in the old shape, so a second run finds nothing to do. If a run is
 * interrupted, run it again.
 */

import { MongoClient, type AnyBulkWriteOperation, type Document } from 'mongodb'

import { isTime } from '../lib/schedule-time.ts'
import { ensureIndexes } from '../lib/mongodb.ts'
import { normalizeEvents } from '../lib/resolver.ts'
import type { EventDoc } from '../lib/models.ts'

type Options = {
  apply: boolean
  confirmDb: string | null
  ownerUsername: string
}

const USAGE = `
Usage: node --experimental-strip-types --env-file=.env.local scripts/migrate-events-to-v2.ts \\
         --confirm-db <name> [--apply] [--owner <username>]

  --confirm-db  The database the run is meant for. Required, and it must match
                the name in MONGODB_URI, so a wrong URI cannot silently migrate
                the wrong deployment.
  --apply       Write the changes. Without it the script only reports what it
                would do.
  --owner       The account the old rows are claimed for. Defaults to
                ADMIN_USERNAME, then to "admin".
`.trim()

function parseArgs(argv: string[]): Options {
  const valueOf = (flag: string): string | null => {
    const index = argv.indexOf(flag)
    return index === -1 ? null : (argv[index + 1] ?? null)
  }

  return {
    apply: argv.includes('--apply'),
    confirmDb: valueOf('--confirm-db'),
    ownerUsername: valueOf('--owner') ?? process.env.ADMIN_USERNAME ?? 'admin',
  }
}

/** Never print a connection string's credentials. */
function maskUri(uri: string): string {
  return uri.replace(/\/\/[^@/]*@/, '//***@')
}

/** True for a row already written in the v2 shape. */
function isV2(doc: Document): boolean {
  return (
    isTime(doc.start) &&
    isTime(doc.end) &&
    typeof doc.repeat === 'object' &&
    doc.repeat !== null
  )
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const uri = process.env.MONGODB_URI

  if (!uri) {
    console.error('MONGODB_URI is not set. Point it at the database to migrate.')
    process.exitCode = 1
    return
  }

  const client = new MongoClient(uri)
  await client.connect()

  try {
    const db = client.db()

    // Nothing is written against a database the operator has not named.
    if (options.confirmDb !== db.databaseName) {
      console.error(
        `Refusing to run: pass --confirm-db ${db.databaseName} to confirm this database.\n\n${USAGE}`
      )
      process.exitCode = 1
      return
    }

    const owner = await db.collection('users').findOne({ username: options.ownerUsername })
    if (!owner) {
      console.error(`No account named "${options.ownerUsername}" in ${db.databaseName}.`)
      process.exitCode = 1
      return
    }

    const targetOwnerId = owner._id.toString()
    const now = new Date()

    // A row needs work while it is unowned, or while it is still in the old
    // shape. That is what makes a second run a no-op.
    const candidates = await db
      .collection('events')
      .find({
        $or: [{ ownerId: { $exists: false } }, { ownerId: null }, { start: { $exists: false } }],
      })
      .toArray()

    // A legacy block's end came from the next block of the same weekday, so the
    // rows have to be grouped per owner before any of them can be read. Rows
    // already claimed keep their own owner; the ownerless ones go to the target.
    const byOwner = new Map<string, Document[]>()
    for (const doc of candidates) {
      const key = doc.ownerId ? String(doc.ownerId) : targetOwnerId
      const list = byOwner.get(key)
      if (list) list.push(doc)
      else byOwner.set(key, [doc])
    }

    const normalized = new Map<string, EventDoc>()
    for (const docs of byOwner.values()) {
      for (const event of normalizeEvents(docs)) normalized.set(String(event._id), event)
    }

    const operations: AnyBulkWriteOperation<Document>[] = []
    let claimed = 0
    let reshaped = 0
    let degenerate = 0

    for (const doc of candidates) {
      const event = normalized.get(String(doc._id))
      if (!event) continue

      const ownerId = doc.ownerId ? String(doc.ownerId) : targetOwnerId
      if (!doc.ownerId) claimed += 1
      if (!isV2(doc)) reshaped += 1
      // A block that ends where it starts occupies no time. The old reader
      // showed it as such, so it is migrated as-is and only reported.
      if (event.end === event.start) degenerate += 1

      const unset: Record<string, ''> = {}
      if (!isV2(doc)) {
        unset.day = ''
        unset.time = ''
      }
      if (!event.note) unset.note = ''

      operations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              // `ownerId` is what every v2 read filters on. `userId` is written
              // beside it, exactly as the seed does, for rows that predate it.
              ownerId,
              userId: ownerId,
              title: event.title,
              category: event.category,
              kind: event.kind,
              start: event.start,
              end: event.end,
              repeat: event.repeat,
              essential: Boolean(event.essential),
              exceptions: event.exceptions ?? [],
              source: 'migration',
              // A legacy row carries no creation date of its own, and the streak
              // must never be counted back before the plan existed — so the
              // account's own creation date stands in.
              createdAt: event.createdAt ?? owner.createdAt ?? now,
              updatedAt: now,
            },
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
          },
        },
      })
    }

    console.log(`Database: ${db.databaseName} (${maskUri(uri)})`)
    console.log(`Owner:    ${options.ownerUsername} (${targetOwnerId})`)
    console.log(`Rows:     ${candidates.length} to change (${claimed} to claim, ${reshaped} to reshape)`)
    if (degenerate) {
      console.log(`Warning:  ${degenerate} row(s) end where they start — worth a look afterwards`)
    }

    for (const operation of operations.slice(0, 5)) {
      if (!('updateOne' in operation)) continue
      const set = (operation.updateOne.update as { $set: Record<string, unknown> }).$set
      console.log(`  · ${String(set.start)}–${String(set.end)}  ${String(set.title)}`)
    }
    if (operations.length > 5) console.log(`  … and ${operations.length - 5} more`)

    if (!options.apply) {
      console.log('\nDry run — nothing written. Add --apply to commit.')
      return
    }

    if (!operations.length) {
      console.log('\nAlready migrated — nothing to do.')
      return
    }

    // The indexes the app depends on must exist before writing.
    await ensureIndexes()

    // Deliberately re-runnable rather than transactional: every operation is an
    // independent per-row rewrite, so an interrupted run is repaired by running
    // it again. A standalone mongod refuses transactions outright, so one could
    // not be relied on here anyway.
    const result = await db.collection('events').bulkWrite(operations, { ordered: false })
    console.log(`\nDone: ${result.modifiedCount} row(s) changed.`)
    console.log('Run it again without --apply to confirm nothing is left to do.')
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exitCode = 1
})
