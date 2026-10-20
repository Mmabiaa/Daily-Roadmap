import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { EventUpdateSchema } from '@/lib/models'
import { isDate } from '@/lib/schedule-time'
import { deleteEvent, updateEvent } from '@/lib/schedule-service'

/**
 * Owner-scoped writes: the filter always includes the owner id, so an event
 * that belongs to another account simply does not match and returns 404.
 *
 * `scope` says how much of a repeating event an edit or delete covers:
 * `this` changes only the given date (an exception), `future` splits the
 * series there, keeping past days and their ticks as they were.
 */
export const PATCH = route(
  { body: EventUpdateSchema, invalidBody: 'Invalid event', failure: 'Failed to update event' },
  async ({ user, params, body }) =>
    NextResponse.json(await updateEvent(user.id, String(params.id), body))
)

export const DELETE = route(
  { failure: 'Failed to delete event' },
  async ({ request, user, params }) => {
    const query = new URL(request.url).searchParams
    const scope = query.get('scope')
    const date = query.get('date')

    if (scope && scope !== 'this' && scope !== 'future') {
      return NextResponse.json({ error: 'scope must be this or future' }, { status: 400 })
    }
    if (date && !isDate(date)) {
      return NextResponse.json({ error: 'Use a YYYY-MM-DD date' }, { status: 400 })
    }

    return NextResponse.json(
      await deleteEvent(user.id, String(params.id), {
        ...(scope === 'this' || scope === 'future' ? { scope } : {}),
        ...(date ? { date } : {}),
      })
    )
  }
)
