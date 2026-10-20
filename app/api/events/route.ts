import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getSession } from '@/lib/auth'
import { EventSchema } from '@/lib/models'

/**
 * Events are private to their owner: every read and write is filtered by the
 * `userId` on the session, so one account can never see or touch another's plan.
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDb()
    const events = await db.collection('events').find({ userId: session.userId }).toArray()

    return NextResponse.json(events.map(e => ({ ...e, _id: e._id.toString() })))
  } catch (error) {
    console.error('Fetch events error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = EventSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid event' },
        { status: 400 }
      )
    }
    const validated = parsed.data

    const db = await getDb()
    const result = await db.collection('events').insertOne({
      userId: session.userId,
      day: validated.day,
      time: validated.time,
      title: validated.title,
      category: validated.category,
      note: validated.note,
      essential: validated.essential,
      createdAt: new Date(),
    })

    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...validated
    }, { status: 201 })
  } catch (error) {
    console.error('Create event error:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
