import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getSession } from '@/lib/auth'
import { EventSchema } from '@/lib/models'
import { ObjectId } from 'mongodb'

/**
 * Owner-scoped updates: the filter always includes `userId`, so an event that
 * belongs to someone else simply does not match and returns 404.
 */
function ownerFilter(id: string, userId: string) {
  if (!ObjectId.isValid(id)) return null
  return { _id: new ObjectId(id), userId }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/events/[id]'>
) {
  try {
    const { id } = await ctx.params

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

    const filter = ownerFilter(id, session.userId)
    if (!filter) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const db = await getDb()
    const result = await db.collection('events').updateOne(filter, {
      $set: {
        day: validated.day,
        time: validated.time,
        title: validated.title,
        category: validated.category,
        note: validated.note,
        essential: validated.essential,
        updatedAt: new Date(),
      },
    })

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ _id: id, ...validated })
  } catch (error) {
    console.error('Update event error:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<'/api/events/[id]'>
) {
  try {
    const { id } = await ctx.params

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const filter = ownerFilter(id, session.userId)
    if (!filter) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const db = await getDb()
    const result = await db.collection('events').deleteOne(filter)

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete event error:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}
