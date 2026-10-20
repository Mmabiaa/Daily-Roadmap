import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { route } from '@/lib/api'
import { EventSchema } from '@/lib/models'

/**
 * Events are private to their owner: every read and write is filtered by the
 * signed-in account, so one account can never see or touch another's plan.
 */
export const GET = route({ failure: 'Failed to fetch events' }, async ({ user }) => {
  const db = await getDb()
  const events = await db.collection('events').find({ userId: user.id }).toArray()

  return NextResponse.json(events.map((e) => ({ ...e, _id: e._id.toString() })))
})

export const POST = route(
  { body: EventSchema, failure: 'Failed to create event' },
  async ({ user, body }) => {
    const db = await getDb()
    const result = await db.collection('events').insertOne({
      userId: user.id,
      day: body.day,
      time: body.time,
      title: body.title,
      category: body.category,
      note: body.note,
      essential: body.essential,
      createdAt: new Date(),
    })

    return NextResponse.json({ _id: result.insertedId.toString(), ...body }, { status: 201 })
  }
)
