import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ObjectId, type Db } from 'mongodb'

import { accountFor } from './accounts.ts'
import { ApiError } from './errors.ts'
import { ensureIndexes, getDb } from './mongodb.ts'
import { accountKey, ipKey } from './rate-limit-policy.ts'
import { recordFailure } from './rate-limit.ts'
import type { EventInput } from './models.ts'
import {
  MAX_EVENTS,
  createEvent,
  deleteEvent,
  getDayView,
  setCompletion,
  updateEvent,
} from './schedule-service.ts'
import { integrationSkipped, startTestDb, type TestDb } from './test-mongo.ts'

/**
 * Behaviour that only a real database can prove: ownership scoping, the
 * completion unique index, series splitting, overlap detection, and the
 * concurrency phases 0 and 1A were designed around.
 *
 * `accountFor` is `requireUser()` without the cookie read, so testing it here
 * is testing the rule that retires a token — `requireUser()` is that call plus
 * a 401 when it answers `null`.
 */

/** 2026-10-19 is a Monday; the next four Mondays are the 26th, and Nov 2 and 9. */
const MONDAY = '2026-10-19'
const NEXT_MONDAY = '2026-10-26'
const SPLIT_MONDAY = '2026-11-02'

/** Skipping must never look like a pass, so say so out loud. */
const skip = integrationSkipped()
if (skip) {
  console.warn('⚠ SKIPPING the database integration suite: SKIP_INTEGRATION=1 is set.')
}

let testDb: TestDb
let db: Db

describe('database-backed behaviour', { skip: skip && 'SKIP_INTEGRATION=1 is set' }, () => {
  before(async () => {
    testDb = await startTestDb()
    await ensureIndexes()
    db = await getDb()
  })

  after(async () => {
    await testDb.stop()
  })

  beforeEach(async () => {
    await testDb.reset()
  })

  const owner = new ObjectId().toString()

  /** A Monday-morning event; pass overrides to change one field at a time. */
  function weekly(over: Partial<EventInput> = {}): EventInput {
    return {
      title: 'Study',
      category: 'study',
      kind: 'flexible',
      start: '09:00',
      end: '10:00',
      repeat: { type: 'weekly', days: ['Mon'] },
      startDate: MONDAY,
      ...over,
    }
  }

  const failsWith = (status: number) => (error: unknown) =>
    error instanceof ApiError && error.status === status

  describe('accountFor', () => {
    it('accepts a session whose token version still matches', async () => {
      const _id = new ObjectId()
      await db.collection('users').insertOne({ _id, username: 'ama', pinHash: 'x', tokenVersion: 0 })

      assert.deepEqual(await accountFor({ userId: _id.toString(), tv: 0 }), {
        id: _id.toString(),
      })
    })

    it('refuses a token issued before the account was bumped', async () => {
      const _id = new ObjectId()
      await db.collection('users').insertOne({ _id, username: 'ama', pinHash: 'x', tokenVersion: 0 })
      const issued = { userId: _id.toString(), tv: 0 }

      // Changing the PIN or signing out everywhere bumps the stored version.
      await db.collection('users').updateOne({ _id }, { $inc: { tokenVersion: 1 } })

      assert.equal(await accountFor(issued), null)
      assert.ok(await accountFor({ userId: _id.toString(), tv: 1 }))
    })

    it('refuses a session for an account that no longer exists', async () => {
      assert.equal(await accountFor({ userId: new ObjectId().toString(), tv: 0 }), null)
    })

    it('refuses a missing or malformed session', async () => {
      assert.equal(await accountFor(null), null)
      assert.equal(await accountFor({ userId: 'not-an-object-id', tv: 0 }), null)
    })

    it('treats an account with no tokenVersion as version 0', async () => {
      const _id = new ObjectId()
      await db.collection('users').insertOne({ _id, username: 'kofi', pinHash: 'x' })

      assert.ok(await accountFor({ userId: _id.toString(), tv: 0 }))
      assert.equal(await accountFor({ userId: _id.toString(), tv: 1 }), null)
    })
  })

  describe('events are owned', () => {
    it('does not let another account read, edit, tick or delete an event', async () => {
      const mine = await createEvent(owner, weekly())
      const other = new ObjectId().toString()

      await assert.rejects(
        () =>
          updateEvent(other, mine._id, {
            ...weekly({ start: '11:00', end: '12:00' }),
            scope: 'future',
            date: MONDAY,
          }),
        failsWith(404)
      )
      await assert.rejects(() => deleteEvent(other, mine._id), failsWith(404))
      await assert.rejects(
        () => setCompletion(other, { date: MONDAY, eventId: mine._id, done: true }),
        failsWith(404)
      )

      const day = await getDayView(owner, MONDAY)
      assert.equal(day.blocks.length, 1)
      assert.equal(day.blocks[0].start, '09:00')
      assert.equal(day.blocks[0].done, false)
    })

    it('answers 404 for a missing or malformed id', async () => {
      await assert.rejects(() => deleteEvent(owner, new ObjectId().toString()), failsWith(404))
      await assert.rejects(() => deleteEvent(owner, 'not-an-id'), failsWith(404))
    })
  })

  describe('completions', () => {
    it('keeps one row per event and date, however many times it is ticked', async () => {
      const event = await createEvent(owner, weekly())

      await setCompletion(owner, { date: MONDAY, eventId: event._id, done: true })
      await setCompletion(owner, { date: MONDAY, eventId: event._id, done: true })

      assert.equal(await db.collection('completions').countDocuments({ ownerId: owner }), 1)
    })

    it('is enforced by the unique index, not only by the handler', async () => {
      const event = await createEvent(owner, weekly())
      const row = { ownerId: owner, date: MONDAY, eventId: event._id, doneAt: new Date() }
      await db.collection('completions').insertOne({ ...row })

      await assert.rejects(
        () => db.collection('completions').insertOne({ ...row }),
        (error: unknown) => (error as { code?: number }).code === 11000
      )
    })

    it('clears the tick on done: false and refuses a date the event is not on', async () => {
      const event = await createEvent(owner, weekly())

      await setCompletion(owner, { date: MONDAY, eventId: event._id, done: true })
      await setCompletion(owner, { date: MONDAY, eventId: event._id, done: false })
      assert.equal(await db.collection('completions').countDocuments({}), 0)

      // The Tuesday after: a Monday event does not occur then.
      await assert.rejects(
        () => setCompletion(owner, { date: '2026-10-20', eventId: event._id, done: true }),
        failsWith(400)
      )
    })

    it('keeps two events that start at the same time separate', async () => {
      const first = await createEvent(owner, weekly({ title: 'A' }))
      const second = await createEvent(owner, weekly({ title: 'B' }))

      await setCompletion(owner, { date: MONDAY, eventId: second._id, done: true })

      const day = await getDayView(owner, MONDAY)
      const done = new Map(day.blocks.map((block) => [block.eventId, block.done]))
      assert.equal(done.size, 2)
      assert.equal(done.get(second._id), true)
      assert.equal(done.get(first._id), false)
    })
  })

  describe('fixed events must not overlap', () => {
    const fixed = (over: Partial<EventInput> = {}) =>
      weekly({ kind: 'fixed', category: 'class', title: 'Class', ...over })

    it('refuses a clash and names the event it clashes with', async () => {
      await createEvent(owner, fixed())

      await assert.rejects(
        () => createEvent(owner, fixed({ title: 'Lab', start: '09:30', end: '10:30' })),
        (error: unknown) =>
          error instanceof ApiError &&
          error.status === 409 &&
          error.message === 'That time clashes with Class (Mon 09:00–10:00)'
      )
    })

    it('allows two fixed events back to back', async () => {
      await createEvent(owner, fixed())
      const later = await createEvent(owner, fixed({ start: '10:00', end: '11:00' }))

      assert.ok(later._id)
    })

    it('allows a fixed event on another weekday', async () => {
      await createEvent(owner, fixed())
      const tuesday = await createEvent(owner, fixed({ repeat: { type: 'weekly', days: ['Tue'] } }))

      assert.ok(tuesday._id)
    })

    it('allows a flexible event on top of a fixed one', async () => {
      await createEvent(owner, fixed())
      const flexible = await createEvent(owner, weekly({ start: '09:30', end: '10:30' }))

      assert.ok(flexible._id)
    })

    it('does not treat two series as clashing when their date ranges never meet', async () => {
      await createEvent(owner, fixed({ startDate: MONDAY, endDate: '2026-10-25' }))
      const later = await createEvent(owner, fixed({ startDate: '2026-11-02' }))

      assert.ok(later._id)
    })
  })

  describe('scope edits', () => {
    it('scope this writes an exception and leaves the rest of the series alone', async () => {
      const event = await createEvent(owner, weekly())

      await updateEvent(owner, event._id, {
        ...weekly({ title: 'Study (short)', start: '08:00', end: '08:30' }),
        scope: 'this',
        date: NEXT_MONDAY,
      })

      const edited = await getDayView(owner, NEXT_MONDAY)
      assert.equal(edited.blocks.length, 1)
      assert.equal(edited.blocks[0].start, '08:00')
      assert.equal(edited.blocks[0].title, 'Study (short)')

      const untouched = await getDayView(owner, SPLIT_MONDAY)
      assert.equal(untouched.blocks[0].start, '09:00')
      assert.equal(untouched.blocks[0].title, 'Study')
    })

    it('refuses scope this on a date the event does not occur', async () => {
      const event = await createEvent(owner, weekly())

      await assert.rejects(
        () => updateEvent(owner, event._id, { ...weekly(), scope: 'this', date: '2026-10-20' }),
        failsWith(400)
      )
    })

    it('scope future splits the series, keeping past days and their ticks', async () => {
      const event = await createEvent(owner, weekly())
      await setCompletion(owner, { date: MONDAY, eventId: event._id, done: true })

      const created = await updateEvent(owner, event._id, {
        ...weekly({ start: '10:00', end: '11:00' }),
        scope: 'future',
        date: SPLIT_MONDAY,
      })
      assert.notEqual(created._id, event._id)

      assert.equal((await getDayView(owner, MONDAY)).blocks[0].done, true)
      assert.equal((await getDayView(owner, NEXT_MONDAY)).blocks[0].start, '09:00')
      assert.equal((await getDayView(owner, SPLIT_MONDAY)).blocks[0].start, '10:00')
    })

    it('replacing the series from its first day drops the old completions', async () => {
      const event = await createEvent(owner, weekly())
      await setCompletion(owner, { date: MONDAY, eventId: event._id, done: true })

      await updateEvent(owner, event._id, {
        ...weekly({ title: 'New' }),
        scope: 'future',
        date: MONDAY,
      })

      assert.equal(await db.collection('completions').countDocuments({ ownerId: owner }), 0)
      const day = await getDayView(owner, MONDAY)
      assert.equal(day.blocks.length, 1)
      assert.equal(day.blocks[0].title, 'New')
    })
  })

  describe('scope deletes', () => {
    it('scope this hides one date without ending the series', async () => {
      const event = await createEvent(owner, weekly())

      await deleteEvent(owner, event._id, { scope: 'this', date: NEXT_MONDAY })

      assert.equal((await getDayView(owner, NEXT_MONDAY)).blocks.length, 0)
      assert.equal((await getDayView(owner, SPLIT_MONDAY)).blocks.length, 1)
    })

    it('scope future ends the series the day before the date', async () => {
      const event = await createEvent(owner, weekly())

      await deleteEvent(owner, event._id, { scope: 'future', date: SPLIT_MONDAY })

      assert.equal((await getDayView(owner, NEXT_MONDAY)).blocks.length, 1)
      assert.equal((await getDayView(owner, SPLIT_MONDAY)).blocks.length, 0)
      assert.equal(await db.collection('events').countDocuments({ _id: new ObjectId(event._id) }), 1)
    })

    it('deleting without a scope removes the event and its completions', async () => {
      const event = await createEvent(owner, weekly())
      await setCompletion(owner, { date: MONDAY, eventId: event._id, done: true })

      assert.deepEqual(await deleteEvent(owner, event._id), {
        deleted: true,
        skipped: false,
        truncated: false,
      })
      assert.equal(await db.collection('events').countDocuments({ ownerId: owner }), 0)
      assert.equal(await db.collection('completions').countDocuments({ ownerId: owner }), 0)
    })
  })

  describe('the per-account event cap', () => {
    it('refuses the event after the cap is reached', async () => {
      await db.collection('events').insertMany(
        Array.from({ length: MAX_EVENTS }, (_, index) => ({
          ownerId: owner,
          title: `Event ${index}`,
          category: 'study',
          kind: 'flexible',
          start: '09:00',
          end: '10:00',
          repeat: { type: 'weekly', days: ['Mon'] },
          essential: false,
          exceptions: [],
          source: 'user',
          createdAt: new Date(),
        }))
      )

      await assert.rejects(() => createEvent(owner, weekly()), failsWith(400))
    })
  })

  describe('concurrency', () => {
    it('counts simultaneous failures without losing an increment', async () => {
      const key = accountKey('ama')

      await Promise.all(Array.from({ length: 12 }, () => recordFailure(key, 'account')))

      const bucket = await db
        .collection<{ _id: string; failures: number }>('rate_limits')
        .findOne({ _id: key })
      assert.equal(bucket?.failures, 12)
    })

    it('locks the address on the 30th failure, whichever account it came from', async () => {
      const key = ipKey('203.0.113.9')

      for (let attempt = 1; attempt < 30; attempt += 1) {
        assert.equal(await recordFailure(key, 'ip'), null, `attempt ${attempt}`)
      }

      const locked = await recordFailure(key, 'ip')
      assert.ok(locked instanceof Date)
      assert.ok(locked.getTime() > Date.now())
      assert.ok(locked.getTime() <= Date.now() + 60 * 60 * 1000 + 1000)
    })

    it('bumps a token version atomically when updates race', async () => {
      const _id = new ObjectId()
      await db.collection('users').insertOne({ _id, username: 'ama', pinHash: 'x', tokenVersion: 0 })

      // The same update a PIN reset runs: new hash and version bump together.
      await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          db
            .collection('users')
            .findOneAndUpdate(
              { _id },
              { $set: { pinHash: `hash-${index}` }, $inc: { tokenVersion: 1 } },
              { returnDocument: 'after' }
            )
        )
      )

      const user = await db.collection('users').findOne({ _id })
      assert.equal(user?.tokenVersion, 20)
      assert.match(String(user?.pinHash), /^hash-\d+$/)
    })
  })
})
