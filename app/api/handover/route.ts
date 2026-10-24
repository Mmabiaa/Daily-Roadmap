import { NextResponse } from 'next/server'
import { HandoverError, handoverDatabase } from '@/lib/handover'
import { checkSeedAccess, providedSeedKey } from '@/lib/seed-access'
import { getDb } from '@/lib/mongodb'

/**
 * The production handover, run from the docs instead of from a script.
 *
 * It writes to the database this deployment is already configured with, so it
 * needs no connection string from the caller, and it is guarded exactly like
 * seeding: the caller presents `SEED_SECRET` in the `x-seed-key` header, and a
 * wrong or missing key answers 404 so the endpoint does not advertise itself.
 *
 * `?dryRun=true` reports what would change and writes nothing; `?owner=<name>`
 * claims the ownerless rows for another account instead of `ADMIN_USERNAME`.
 */
async function handleHandover(request: Request) {
  const url = new URL(request.url)

  const access = checkSeedAccess({
    providedKey: providedSeedKey(request),
    configuredSecret: process.env.SEED_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
  })

  if (access !== 'ok') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const dryRun = ['1', 'true', 'yes'].includes(
    (url.searchParams.get('dryRun') ?? '').toLowerCase()
  )

  try {
    const report = await handoverDatabase(await getDb(), {
      owner: url.searchParams.get('owner') ?? undefined,
      dryRun,
    })

    const message = report.done
      ? 'Already handed over — nothing to do'
      : report.dryRun
        ? 'Dry run — nothing written'
        : 'Handover complete'

    return NextResponse.json({ success: true, message, ...report })
  } catch (error: any) {
    console.error('Handover error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Handover failed' },
      { status: error instanceof HandoverError ? 400 : 500 }
    )
  }
}

export async function GET(request: Request) {
  return handleHandover(request)
}

export async function POST(request: Request) {
  return handleHandover(request)
}
