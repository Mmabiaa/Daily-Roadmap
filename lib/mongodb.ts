import { MongoClient, Db } from 'mongodb'

const options = {}

let clientPromise: Promise<MongoClient> | null = null

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  
  if (!uri) {
    throw new Error('Please add MONGODB_URI to .env.local')
  }

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options)
      global._mongoClientPromise = client.connect()
    }
    return global._mongoClientPromise
  } else {
    if (!clientPromise) {
      const client = new MongoClient(uri, options)
      clientPromise = client.connect()
    }
    return clientPromise
  }
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db()
}

/**
 * Creates every index the app relies on, once per server process.
 *
 * Three of these are correctness guarantees, not just query speed:
 * the unique indexes on `users.username` / `users.email` make a duplicate
 * sign-up impossible even when two requests race, the TTL index on
 * `pin_resets.expiresAt` lets MongoDB delete used-up codes by itself, and the
 * unique index on a completion stops one block being ticked twice.
 */
let indexes: Promise<void> | null = null

export function ensureIndexes(): Promise<void> {
  if (!indexes) {
    indexes = (async () => {
      const db = await getDb()
      await Promise.all([
        db.collection('users').createIndex({ username: 1 }, { unique: true }),
        db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
        // Events are read by owner; the resolver filters the days in memory.
        db.collection('events').createIndex({ ownerId: 1 }),
        // One completion per event per day. Unique, so a retried or double
        // tap cannot create a second row for the same block.
        db
          .collection('completions')
          .createIndex({ ownerId: 1, date: 1, eventId: 1 }, { unique: true }),
        db.collection('progress').createIndex({ userId: 1 }, { unique: true }),
        db.collection('pin_resets').createIndex({ userId: 1 }, { unique: true }),
        db.collection('pin_resets').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        // Sign-in throttling buckets. TTL so a quiet deployment cleans itself up.
        db.collection('rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ])
    })().catch((error) => {
      // Let the next request retry rather than caching a failed setup forever.
      indexes = null
      throw error
    })
  }
  return indexes
}

export default getClientPromise
