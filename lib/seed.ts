import { getDb } from './mongodb'
import { hashPin } from './auth'
import { schedule, days, Day } from './schedule'

export async function seedDatabase() {
  const db = await getDb()
  
  // Seed admin user
  const username = process.env.ADMIN_USERNAME || 'admin'
  const pin = process.env.ADMIN_PIN || '1234'
  
  const existingUser = await db.collection('users').findOne({ username })
  
  if (!existingUser) {
    const pinHash = await hashPin(pin)
    await db.collection('users').insertOne({
      username,
      pinHash,
      createdAt: new Date(),
    })
    console.log('✓ Admin user created')
  } else {
    console.log('✓ Admin user already exists')
  }
  
  // Seed schedule events
  const existingEvents = await db.collection('events').countDocuments()
  
  if (existingEvents === 0) {
    const events = []
    
    for (const day of days) {
      const blocks = schedule[day as Day]
      for (const block of blocks) {
        events.push({
          day,
          time: block.time,
          title: block.title,
          category: block.category,
          note: block.note,
          essential: block.essential,
        })
      }
    }
    
    await db.collection('events').insertMany(events)
    console.log(`✓ Seeded ${events.length} events`)
  } else {
    console.log(`✓ Database already has ${existingEvents} events`)
  }
}
