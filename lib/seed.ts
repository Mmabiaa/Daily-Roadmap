import { getDb, ensureIndexes } from './mongodb'
import { hashPin, normalizeEmail } from './auth'
import { schedule, days, Day } from './schedule'
import { NEW_PIN_PATTERN, NEW_PIN_RULE } from './pin'
import { normalizeTimeZone } from './timezone'

export async function seedDatabase() {
  const db = await getDb()
  await ensureIndexes()

  const username = process.env.ADMIN_USERNAME || 'admin'
  const pin = process.env.ADMIN_PIN
  const email = process.env.ADMIN_EMAIL ? normalizeEmail(process.env.ADMIN_EMAIL) : undefined
  // The admin's own wall clock, so its "today" matches the day it is living in.
  const timezone = normalizeTimeZone(process.env.ADMIN_TIMEZONE)

  // Refuse to run without a real PIN. A seeded account must never fall back to a
  // well-known default, because that account is reachable from the sign-in page.
  if (!pin || !NEW_PIN_PATTERN.test(pin)) {
    throw new Error(`Set ADMIN_PIN before seeding. ${NEW_PIN_RULE}.`)
  }

  // 1. The first account. Created once and never overwritten, so re-running the
  //    seed never resets an existing PIN.
  const existing = await db.collection('users').findOne({ username })
  let adminId: string

  if (existing) {
    adminId = existing._id.toString()
    console.log('✓ Admin user already exists')
  } else {
    const result = await db.collection('users').insertOne({
      username,
      ...(email ? { email } : {}),
      pinHash: await hashPin(pin),
      timezone,
      createdAt: new Date(),
    })
    adminId = result.insertedId.toString()
    console.log('✓ Admin user created')
  }

  // 2. Events stored before scheduling became per-user have no owner. Claim
  //    them for the admin so nothing is lost when reads become user-scoped.
  const claimed = await db.collection('events').updateMany(
    { userId: { $exists: false } },
    { $set: { userId: adminId } }
  )
  if (claimed.modifiedCount) {
    console.log(`✓ Linked ${claimed.modifiedCount} existing events to ${username}`)
  }

  // 3. Give the admin the starter plan, once. Every other account starts empty
  //    and adds its own events.
  const adminEvents = await db.collection('events').countDocuments({ userId: adminId })
  if (adminEvents === 0) {
    const events = []

    for (const day of days) {
      const blocks = schedule[day as Day]
      for (const block of blocks) {
        events.push({
          userId: adminId,
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
    console.log(`✓ Admin already has ${adminEvents} events`)
  }

  // 4. Attach ADMIN_EMAIL to an admin created before it was configured, so
  //    PIN resets work for the original account too.
  if (existing && email && !existing.email) {
    try {
      await db.collection('users').updateOne({ _id: existing._id }, { $set: { email, updatedAt: new Date() } })
      console.log('✓ Added email to the admin account')
    } catch (error) {
      console.warn('⚠ Could not attach ADMIN_EMAIL (already used by another account?)', error)
    }
  }

  // 5. Same for the zone: filled in only where the account has none, so a value
  //    set later is never overwritten by a redeploy.
  if (existing && process.env.ADMIN_TIMEZONE && !existing.timezone) {
    await db.collection('users').updateOne({ _id: existing._id }, { $set: { timezone } })
    console.log(`✓ Set the admin timezone to ${timezone}`)
  }
}
