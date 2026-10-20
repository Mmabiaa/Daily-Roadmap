import { MongoClient, type Db } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'

import getClientPromise from './mongodb.ts'

/**
 * A throwaway MongoDB for the integration suite.
 *
 * The guarantees the suite checks — a unique index refusing a second row, two
 * concurrent updates not losing each other's increment, an upsert creating
 * exactly one document — are properties of MongoDB itself. An in-memory fake
 * would only assert that the fake behaves the way it was written, so these
 * tests run a real server.
 *
 * If a server cannot be started the tests must fail: a suite that silently
 * skips is worse than no suite, because it looks like a pass. Set
 * `SKIP_INTEGRATION=1` to leave it out deliberately (offline, or a machine that
 * cannot run mongod), and the run prints a warning saying so.
 */

/** Server version used when no system binary or explicit version is configured. */
const SERVER_VERSION = '7.0.14'

/** Set `SKIP_INTEGRATION=1` to leave the database-backed suite out. */
export function integrationSkipped(): boolean {
  return process.env.SKIP_INTEGRATION === '1'
}

export type TestDb = {
  db: Db
  /** Empties every collection the suite touches, leaving the indexes in place. */
  reset(): Promise<void>
  stop(): Promise<void>
}

/** Collections `reset` clears between tests. */
const COLLECTIONS = ['users', 'events', 'completions', 'progress', 'rate_limits', 'pin_resets']

/**
 * Starts a local mongod on a random port and points the app's own client at it,
 * so `getDb()` and everything built on it talk to this server.
 */
export async function startTestDb(): Promise<TestDb> {
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY
  // `MONGOMS_SYSTEM_BINARY` points at a mongod already on the machine, for
  // environments that cannot download one; `MONGOMS_VERSION` overrides the pin.
  const binary = systemBinary
    ? { systemBinary }
    : { version: process.env.MONGOMS_VERSION ?? SERVER_VERSION }

  const server = await MongoMemoryServer.create({
    binary,
    instance: { launchTimeout: 120_000 },
  })

  const uri = server.getUri()
  process.env.MONGODB_URI = uri

  const client = await MongoClient.connect(uri)
  const db = client.db()

  return {
    db,
    async reset() {
      await Promise.all(COLLECTIONS.map((name) => db.collection(name).deleteMany({})))
    },
    async stop() {
      // The app's own client (used by `getDb()`) would otherwise keep the
      // event loop alive and the test run would never exit.
      await (await getClientPromise()).close()
      await client.close()
      await server.stop()
    },
  }
}
