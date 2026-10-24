import { NextResponse } from 'next/server'
import { seedDatabase } from '@/lib/seed'
import { checkSeedAccess, providedSeedKey } from '@/lib/seed-access'

/**
 * Seeding creates the first account, so the endpoint is not public: the caller
 * must present `SEED_SECRET` in the `x-seed-key` header. When no secret is
 * configured, seeding is switched off in production (see `checkSeedAccess`).
 *
 * A wrong or missing key answers 404, the same as a route that does not exist,
 * so the endpoint does not advertise itself.
 */
async function handleSeed(request: Request) {
  const access = checkSeedAccess({
    providedKey: providedSeedKey(request),
    configuredSecret: process.env.SEED_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
  })

  if (access !== 'ok') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await seedDatabase()
    return NextResponse.json({ success: true, message: 'Database seeded successfully' })
  } catch (error: any) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to seed database' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handleSeed(request)
}

export async function POST(request: Request) {
  return handleSeed(request)
}
