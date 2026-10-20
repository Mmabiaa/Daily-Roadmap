import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { EventInputSchema } from '@/lib/models'
import { isDate } from '@/lib/schedule-time'
import { createEvent, getDayView, getWeekView, listEvents } from '@/lib/schedule-service'

/**
 * Events are private to their owner: every read and write is filtered by the
 * signed-in account, so one account can never see or touch another's plan.
 *
 * A plain GET returns the owner's stored events. `?date=` resolves a single day
 * and `?week=` resolves the seven days from that week's Monday; both come back
 * with each block's tick already applied and the owner's timezone and today, so
 * the client never has to join events against completions or guess the date.
 */
export const GET = route({ failure: 'Failed to fetch events' }, async ({ request, user }) => {
  const query = new URL(request.url).searchParams
  const anchor = query.get('date') ?? query.get('week')

  if (!anchor) return NextResponse.json(await listEvents(user.id))
  if (!isDate(anchor)) {
    return NextResponse.json({ error: 'Use a YYYY-MM-DD date' }, { status: 400 })
  }

  return NextResponse.json(
    query.has('week') ? await getWeekView(user.id, anchor) : await getDayView(user.id, anchor)
  )
})

/**
 * Creates an event owned by the session user. Fixed events must not overlap:
 * a clash with another fixed event is a 409 naming the event it conflicts with.
 */
export const POST = route(
  { body: EventInputSchema, invalidBody: 'Invalid event', failure: 'Failed to create event' },
  async ({ user, body }) => NextResponse.json(await createEvent(user.id, body), { status: 201 })
)
