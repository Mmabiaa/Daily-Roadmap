import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { getInsights } from '@/lib/insights'

/**
 * What the signed-in account keeps and what slips, read from its own history.
 *
 * Read-only and computed on demand: it resolves each block against the days
 * that are already over and counts the ticks against them, so the review page
 * never has to walk the schedule in the browser.
 */
export const GET = route({ failure: 'Failed to read your review' }, async ({ user }) =>
  NextResponse.json(await getInsights(user.id))
)
