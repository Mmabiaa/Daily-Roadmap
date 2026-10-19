import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export async function GET() {
  try {
    const db = await getDb()
    const users = await db.collection('users').find({}).toArray()
    const events = await db.collection('events').countDocuments()
    
    return NextResponse.json({
      success: true,
      connected: true,
      usersCount: users.length,
      eventsCount: events,
      users: users.map(u => ({ username: u.username, id: u._id }))
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
