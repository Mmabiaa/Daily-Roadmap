import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getSession } from '@/lib/auth'
import { EventSchema } from '@/lib/models'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const db = await getDb()
    const events = await db.collection('events').find({}).toArray()
    
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
    
    const body = await request.json()
    const validated = EventSchema.parse(body)
    
    const db = await getDb()
    const result = await db.collection('events').insertOne({
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
