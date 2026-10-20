import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { CompletionToggleSchema } from '@/lib/models'
import { setCompletion } from '@/lib/schedule-service'

/**
 * Ticks a block on a date, or clears it.
 *
 * A completion is keyed by the event id, not by the block's position in the
 * day, so moving a block's time no longer orphans its tick and two blocks that
 * start at the same time keep separate ticks. The event must belong to the
 * caller *and* actually occur on that date, so a stale or guessed id cannot be
 * used to write one.
 */
export const PATCH = route(
  {
    body: CompletionToggleSchema,
    invalidBody: 'Invalid completion',
    failure: 'Failed to save completion',
  },
  async ({ user, body }) => NextResponse.json(await setCompletion(user.id, body))
)
