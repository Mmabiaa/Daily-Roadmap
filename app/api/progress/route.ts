import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ApiError, route } from '@/lib/api'
import { ProgressSchema } from '@/lib/models'

const COLLECTION = 'progress'

// Mongo reads dots as field paths and `$`-prefixed keys as operators, so a key
// containing them could be used for injection. Our keys are only dates and
// `fyr:date:day:time` strings, but validate before turning them into paths.
const isSafeKey = (key: string) => key.length > 0 && !key.includes('.') && !key.startsWith('$')

function progressResponse(doc: Record<string, unknown> | null) {
  return NextResponse.json({
    checks: doc?.checks ?? {},
    reviews: doc?.reviews ?? {},
    energy: doc?.energy ?? {},
    theme: doc?.theme ?? null,
  })
}

export const GET = route({ failure: 'Failed to fetch progress' }, async ({ user }) => {
  const db = await getDb()
  const doc = await db.collection(COLLECTION).findOne({ userId: user.id })

  return progressResponse(doc)
})

export const PATCH = route(
  { body: ProgressSchema, invalidBody: 'Invalid progress payload', failure: 'Failed to update progress' },
  async ({ user, body }) => {
    // Merge each provided entry by its own path so concurrent edits from
    // different blocks never clobber one another.
    const set: Record<string, unknown> = { updatedAt: new Date() }

    for (const [key, done] of Object.entries(body.checks ?? {})) {
      if (!isSafeKey(key)) throw new ApiError(400, 'Invalid check key')
      set[`checks.${key}`] = done
    }
    for (const [date, answers] of Object.entries(body.reviews ?? {})) {
      if (!isSafeKey(date)) throw new ApiError(400, 'Invalid review key')
      set[`reviews.${date}`] = answers
    }
    for (const [date, value] of Object.entries(body.energy ?? {})) {
      if (!isSafeKey(date)) throw new ApiError(400, 'Invalid energy key')
      set[`energy.${date}`] = value
    }
    if (body.theme) set.theme = body.theme

    const db = await getDb()
    await db.collection(COLLECTION).updateOne(
      { userId: user.id },
      { $set: set, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    )

    const doc = await db.collection(COLLECTION).findOne({ userId: user.id })

    return progressResponse(doc)
  }
)
