import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getSession } from '@/lib/auth'
import { ProgressSchema } from '@/lib/models'

const COLLECTION = 'progress'

// Mongo reads dots as field paths and `$`-prefixed keys as operators, so a key
// containing them could be used for injection. Our keys are only dates and
// `fyr:date:day:time` strings, but validate before turning them into paths.
const isSafeKey = (key: string) => key.length > 0 && !key.includes('.') && !key.startsWith('$')

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDb()
    const doc = await db.collection(COLLECTION).findOne({ userId: session.userId })

    return NextResponse.json({
      checks: doc?.checks ?? {},
      reviews: doc?.reviews ?? {},
      energy: doc?.energy ?? {},
      theme: doc?.theme ?? null,
    })
  } catch (error) {
    console.error('Fetch progress error:', error)
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = ProgressSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid progress payload' }, { status: 400 })
    }
    const { checks, reviews, energy, theme } = parsed.data

    // Merge each provided entry by its own path so concurrent edits from
    // different blocks never clobber one another.
    const set: Record<string, unknown> = { updatedAt: new Date() }

    for (const [key, done] of Object.entries(checks ?? {})) {
      if (!isSafeKey(key)) return NextResponse.json({ error: 'Invalid check key' }, { status: 400 })
      set[`checks.${key}`] = done
    }
    for (const [date, answers] of Object.entries(reviews ?? {})) {
      if (!isSafeKey(date)) return NextResponse.json({ error: 'Invalid review key' }, { status: 400 })
      set[`reviews.${date}`] = answers
    }
    for (const [date, value] of Object.entries(energy ?? {})) {
      if (!isSafeKey(date)) return NextResponse.json({ error: 'Invalid energy key' }, { status: 400 })
      set[`energy.${date}`] = value
    }
    if (theme) set.theme = theme

    const db = await getDb()
    await db.collection(COLLECTION).updateOne(
      { userId: session.userId },
      { $set: set, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    )

    const doc = await db.collection(COLLECTION).findOne({ userId: session.userId })

    return NextResponse.json({
      checks: doc?.checks ?? {},
      reviews: doc?.reviews ?? {},
      energy: doc?.energy ?? {},
      theme: doc?.theme ?? null,
    })
  } catch (error) {
    console.error('Update progress error:', error)
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
  }
}
