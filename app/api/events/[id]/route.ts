import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { route } from '@/lib/api'
import { EventSchema } from '@/lib/models'

/**
 * Owner-scoped updates: the filter always includes `userId`, so an event that
 * belongs to someone else simply does not match and returns 404.
 */
function ownerFilter(id: string, userId: string) {
  if (!ObjectId.isValid(id)) return null
  return { _id: new ObjectId(id), userId }
}

export const PATCH = route(
  { body: EventSchema, failure: 'Failed to update event' },
  async ({ user, params, body }) => {
    const id = String(params.id)
    const filter = ownerFilter(id, user.id)
    if (!filter) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const db = await getDb()
    const result = await db.collection('events').updateOne(filter, {
      $set: {
        day: body.day,
        time: body.time,
        title: body.title,
        category: body.category,
        note: body.note,
        essential: body.essential,
        updatedAt: new Date(),
      },
    })

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ _id: id, ...body })
  }
)

export const DELETE = route(
  { failure: 'Failed to delete event' },
  async ({ user, params }) => {
    const filter = ownerFilter(String(params.id), user.id)
    if (!filter) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const db = await getDb()
    const result = await db.collection('events').deleteOne(filter)

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  }
)
