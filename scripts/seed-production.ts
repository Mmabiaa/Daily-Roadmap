/**
 * Production handover: give the pre-account rows an owner, and put every other
 * account through the new setup.
 *
 * Until accounts existed the schedule was one global list, and those rows name
 * nobody. Every read now filters by `ownerId`, so an unowned row is invisible
 * to everyone — it would quietly disappear the moment this code goes live. This
 * claims those rows for one account (the admin, by default) and leaves every
 * row that already has an owner exactly where it is. A row that names a
 * `userId` but no `ownerId` is given back to its own account, never to the
 * admin.
 *
 * The remaining accounts are then marked `onboarded: false`, so each of them
 * meets the one-minute setup and ends up with a plan of its own, instead of
 * arriving in an app nobody has set up for them. The admin is marked
 * `onboarded: true`, so the one account that already keeps a schedule walks
 * straight in.
 *
 * Nothing is deleted and a claimed row keeps every field it had — its owner is
 * added, nothing is replaced — so no run of this can lose an event. Their own
 * events are what keep the others from being given a fresh plan: onboarding
 * only drafts a week when an account has none.
 *
 * Run it as a dry run first; nothing is written without `--apply`.
 *
 *   node --experimental-strip-types --env-file=.env.production.local \
 *     scripts/seed-production.ts --confirm-db <name>
 *
 *   node --experimental-strip-types --env-file=.env.production.local \
 *     scripts/seed-production.ts --confirm-db <name> --apply
 *
 * It is re-runnable: a row is only selected while it has no owner, and an
 * account is only changed while it is not already where it should be, so a
 * second run finds nothing to do. If a run is interrupted, run it again.
 */

import { MongoClient, type Document } from 'mongodb'

type Options = {
  apply: boolean
  confirmDb: string | null
  ownerUsername: string
}

const USAGE = `
Usage: node --experimental-strip-types --env-file=.env.production.local \\
         scripts/seed-production.ts --confirm-db <name> [--apply] [--owner <username>]

  --confirm-db  The database the run is meant for. Required, and it must match
                the name in MONGODB_URI, so a wrong URI cannot silently hand the
                wrong deployment's data to one account.
  --apply       Write the changes. Without it the script only reports what it
                would do.
  --owner       The account the ownerless rows are claimed for. Defaults to
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

/**
 * Rows no read can find: they name no `ownerId`.
 *
 * `ownerId: null` already matches a missing field as well, but the `$exists`
 * arm says out loud that both shapes are meant.
 */
const UNOWNED = { $or: [{ ownerId: { $exists: false } }, { ownerId: null }] }

/** An unowned row that still remembers whose it is — `userId` without an `ownerId`. */
const KEEPS_ITS_OWNER = { ...UNOWNED, userId: { $ne: null } }

/** An unowned row that names neither: it has belonged to no one. */
const OWNERLESS = { ...UNOWNED, userId: null }

/** `Mon 08:30  Morning run` — reads either shape, since both are in there. */
function describe(row: Document): string {
  const day = row.repeat?.days?.[0] ?? row.day ?? ''
  const when = row.start ?? row.time ?? ''
  return `${String(day)} ${String(when)}  ${String(row.title ?? '')}`.trim()
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const uri = process.env.MONGODB_URI

  if (!uri) {
    console.error('MONGODB_URI is not set. Point it at the database to hand over.')
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
      console.error(
        `No account named "${options.ownerUsername}" in ${db.databaseName}. ` +
          'Create it first (POST /api/seed with the x-seed-key header), then run this again.'
      )
      process.exitCode = 1
      return
    }

    const ownerId = owner._id.toString()
    const now = new Date()

    const events = db.collection('events')
    const users = db.collection('users')
    const profiles = db.collection('profiles')

    // 1. What the run will do to the events.
    const backfillCount = await events.countDocuments(KEEPS_ITS_OWNER)
    const claimCount = await events.countDocuments(OWNERLESS)
    const ownerEventCount = await events.countDocuments({ ownerId })
    const preview = await events.find(UNOWNED, { limit: 5 }).toArray()
    // Reads normalise a `day`/`time` row on the way out, so one of these shows
    // up correctly whether or not the stored shape was rewritten.
    const legacyShaped = await events.countDocuments({ start: { $exists: false } })

    // 2. Who else is on this deployment, what they keep, and what still needs
    //    changing. An account already in the state it should be in is left out
    //    of the work — that is what makes a second run a no-op.
    const others = (await users.find({}, { projection: { username: 1 } }).toArray()).filter(
      (user) => user._id.toString() !== ownerId
    )
    const otherIds = others.map((user) => user._id.toString())
    const ownedByOthers = new Map<string, number>(
      (
        await events
          .aggregate([
            { $match: { ownerId: { $in: otherIds } } },
            { $group: { _id: '$ownerId', count: { $sum: 1 } } },
          ])
          .toArray()
      ).map((row) => [String(row._id), Number(row.count)])
    )
    const profilesOf = new Map(
      (await profiles.find({ userId: { $in: [ownerId, ...otherIds] } }).toArray()).map((doc) => [
        String(doc.userId),
        doc,
      ])
    )
    const toEnrol = others.filter((user) => profilesOf.get(user._id.toString())?.onboarded !== false)
    const adminNeedsWork = profilesOf.get(ownerId)?.onboarded !== true

    console.log(`Database:  ${db.databaseName} (${maskUri(uri)})`)
    console.log(`Admin:     ${options.ownerUsername} (${ownerId}) — keeps ${ownerEventCount} event(s)`)
    console.log(
      `Unowned:   ${backfillCount + claimCount} row(s) (${backfillCount} returned to their own ` +
        `account, ${claimCount} claimed for the admin)`
    )
    for (const row of preview) console.log(`  · ${describe(row)}`)
    if (backfillCount + claimCount > preview.length) {
      console.log(`  … and ${backfillCount + claimCount - preview.length} more`)
    }
    if (legacyShaped) {
      console.log(
        `Note:      ${legacyShaped} row(s) are still stored in the old day/time shape. They read ` +
          'correctly; scripts/migrate-events-to-v2.ts rewrites them if you want the stored shape ' +
          'updated too.'
      )
    }
    console.log(
      `Others:    ${others.length} account(s), ${toEnrol.length} to enrol in the new setup` +
        (others.length
          ? ` (${others
              .map((user) => `${user.username}: ${ownedByOthers.get(user._id.toString()) ?? 0} event(s)`)
              .join(', ')})`
          : '')
    )
    console.log(
      `Setup:     ${options.ownerUsername} ` +
        (adminNeedsWork ? 'is marked onboarded (goes straight to the app)' : 'is already onboarded')
    )

    const work = backfillCount + claimCount + toEnrol.length + (adminNeedsWork ? 1 : 0)
    if (!work) {
      console.log('\nAlready handed over — nothing to do.')
      return
    }

    if (!options.apply) {
      console.log('\nDry run — nothing written. Add --apply to commit.')
      return
    }

    // 3. A row that names a `userId` already knows its owner: it is only given
    //    the `ownerId` the v2 reads filter on. Written as a pipeline update so
    //    each row takes its own `userId`, not one id for all of them.
    const backfilled = await events.updateMany(KEEPS_ITS_OWNER, [{ $set: { ownerId: '$userId' } }])

    // 4. What is left belonged to nobody, so it goes to the admin. Only the
    //    owner is added — the row keeps its title, times and shape.
    const claimed = await events.updateMany(OWNERLESS, { $set: { ownerId, userId: ownerId } })

    // 5. The admin goes straight in; everyone else is due the setup. An
    //    existing profile is only marked, never rewritten, so answers already
    //    given (and events already planned) survive the handover.
    //    Deliberately re-runnable rather than transactional: each account is
    //    its own small write, and an interrupted run is repaired by running it
    //    again. The filters are plain equality, so an upsert cannot produce a
    //    second profile for an account.
    const admin = adminNeedsWork
      ? await profiles.updateOne(
          { userId: ownerId },
          { $set: { onboarded: true, updatedAt: now } },
          { upsert: true }
        )
      : null

    for (const user of toEnrol) {
      await profiles.updateOne(
        { userId: user._id.toString() },
        { $set: { onboarded: false, updatedAt: now } },
        { upsert: true }
      )
    }

    console.log(
      `\nDone: ${backfilled.modifiedCount} row(s) returned, ${claimed.modifiedCount} row(s) ` +
        `claimed, ${toEnrol.length} account(s) enrolled` +
        `${admin?.upsertedCount ? `, a profile created for ${options.ownerUsername}` : ''}.`
    )
    console.log(
      `${options.ownerUsername} still has ${await events.countDocuments({ ownerId })} event(s).`
    )
    console.log('Run it again without --apply to confirm nothing is left to do.')
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error('Handover failed:', error)
  process.exitCode = 1
})
