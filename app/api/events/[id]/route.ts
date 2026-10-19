import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getSession } from '@/lib/auth'
import { EventSchema } from '@/lib/models'
import { ObjectId } from 'mongodb'

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
    
    const body = await request.json()
    const validated = EventSchema.parse(body)
    
    const db = await getDb()
    const result = await db.collection('events').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          day: validated.day,
          time: validated.time,
          title: validated.title,
          category: validated.category,
          note: validated.note,
          essential: validated.essential,
          updatedAt: new Date(),
        },
      }
    )
    
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
    
    const db = await getDb()
    const result = await db.collection('events').deleteOne({
      _id: new ObjectId(id),
    })
    
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
