import type { Db } from 'mongodb'

/**
 * The production handover: give the pre-account rows an owner, and put every
 * other account through the new setup.
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
 * It is re-runnable: a row is only selected while it has no owner, and an
 * account is only changed while it is not already where it should be, so a
 * second run finds nothing to do. If a run is interrupted, run it again.
 *
 * It is served by `POST /api/handover`, so it can be run against a deployment
 * from the docs without ever handling its connection string.
 */

/** Raised when the run cannot start, and the caller's input is what to change. */
export class HandoverError extends Error {}

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

export type HandoverReport = {
  /** The account the ownerless rows are claimed for. */
  owner: string
  /** The database the run touched, so the operator can see where it landed. */
  database: string
  /** True when nothing was written and the counts are only what would change. */
  dryRun: boolean
  /** Unowned rows given back to the account their own `userId` names. */
  returned: number
  /** Unowned rows that named nobody, claimed for `owner`. */
  claimed: number
  /** The other accounts on this deployment. */
  accounts: number
  /** Accounts put through the new setup. */
  enrolled: number
  /** True when the run found nothing left to do. */
  done: boolean
}

export async function handoverDatabase(
  db: Db,
  input: { owner?: string; dryRun?: boolean } = {}
): Promise<HandoverReport> {
  const dryRun = input.dryRun ?? false
  const ownerUsername = input.owner?.trim() || process.env.ADMIN_USERNAME || 'admin'

  const owner = await db.collection('users').findOne({ username: ownerUsername })
  if (!owner) {
    throw new HandoverError(
      `No account named "${ownerUsername}" in ${db.databaseName}. Create it first ` +
        '(POST /api/seed with the x-seed-key header), then call this again.'
    )
  }

  const ownerId = owner._id.toString()
  const events = db.collection('events')
  const profiles = db.collection('profiles')

  // A row that names a `userId` already knows its owner, so it is not counted
  // as work for the admin.
  const returned = await events.countDocuments(KEEPS_ITS_OWNER)
  const claimed = await events.countDocuments(OWNERLESS)

  // Every other account, and the state its profile is in. An account that is
  // already where it should be is left out of the work — that is what makes a
  // second run a no-op.
  const others = (await db.collection('users').find({}).toArray()).filter(
    (user) => user._id.toString() !== ownerId
  )
  const profilesOf = new Map(
    (
      await profiles
        .find({ userId: { $in: [ownerId, ...others.map((user) => user._id.toString())] } })
        .toArray()
    ).map((doc) => [String(doc.userId), doc])
  )
  const toEnrol = others.filter((user) => profilesOf.get(user._id.toString())?.onboarded !== false)
  const ownerNeedsWork = profilesOf.get(ownerId)?.onboarded !== true
  const done = returned + claimed + toEnrol.length + (ownerNeedsWork ? 1 : 0) === 0

  const report: HandoverReport = {
    owner: ownerUsername,
    database: db.databaseName,
    dryRun,
    returned,
    claimed,
    accounts: others.length,
    enrolled: toEnrol.length,
    done,
  }

  if (dryRun || done) return report

  // A row keeps every field it had — only an owner is added — so no run of
  // this can lose an event. Written as a pipeline update so each row takes its
  // own `userId`, not one id for all of them.
  await events.updateMany(KEEPS_ITS_OWNER, [{ $set: { ownerId: '$userId' } }])
  await events.updateMany(OWNERLESS, { $set: { ownerId, userId: ownerId } })

  // The admin goes straight in; everyone else is due the setup. An existing
  // profile is only marked, never rewritten, so answers already given (and
  // events already planned) survive the handover. Each account is its own
  // small write, and the filters are plain equality, so an upsert cannot
  // produce a second profile for an account and a re-run repairs an
  // interrupted one.
  const now = new Date()

  if (ownerNeedsWork) {
    await profiles.updateOne(
      { userId: ownerId },
      { $set: { onboarded: true, updatedAt: now } },
      { upsert: true }
    )
  }

  for (const user of toEnrol) {
    await profiles.updateOne(
      { userId: user._id.toString() },
      { $set: { onboarded: false, updatedAt: now } },
      { upsert: true }
    )
  }

  return report
}
