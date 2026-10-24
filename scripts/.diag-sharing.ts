/** Temporary, read-only: what the recipient's own week view resolves. */
import { MongoClient } from 'mongodb'
import { getWeekView, listEvents } from '../lib/schedule-service.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI is not set')

const client = new MongoClient(uri)
await client.connect()
const db = client.db()

const user = await db.collection('users').findOne({ username: 'mnny' })
if (!user) throw new Error('no such account')
const id = String(user._id)

const listed = await listEvents(id)
console.log('listEvents:', listed.length)
console.log('categories:', JSON.stringify(listed.reduce((all: Record<string, number>, e) => ({ ...all, [e.category]: (all[e.category] ?? 0) + 1 }), {})))

const week = await getWeekView(id, new Date().toISOString().slice(0, 10))
console.log('today:', week.today, 'weekStart:', week.weekStart)
for (const day of week.days) {
  console.log(
    day.date,
    day.blocks.length,
    day.blocks.map((block) => `${block.start}-${block.end} ${block.title} [${block.category}/${block.kind}]`).join(' | ')
  )
}

await client.close()
