import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { EventInputSchema } from '@/lib/models'
import { isDate } from '@/lib/schedule-time'
import { createEvent, getDayView, getWeekView, listEvents, timezoneFor } from '@/lib/schedule-service'
import { todayIn } from '@/lib/timezone'

/**
 * Events are private to their owner: every read and write is filtered by the
 * signed-in account, so one account can never see or touch another's plan.
 *
 * A plain GET returns the owner's stored events. `?date=` resolves a single day
 * and `?week=` resolves the seven days from that week's Monday; both come back
 * with each block's tick already applied and the owner's timezone and today, so
 * the client never has to join events against completions or guess the date.
 * Given with no value, `?date`/`?week` mean the owner's own today / current
 * week: the server holds the account's zone, and the browser clock is the one
 * thing that must not decide which day the plan is on.
 */
export const GET = route({ failure: 'Failed to fetch events' }, async ({ request, user }) => {
  const query = new URL(request.url).searchParams
  const date = query.get('date')
  const week = query.get('week')

  if (date === null && week === null) return NextResponse.json(await listEvents(user.id))

  const anchor = date || week || todayIn(await timezoneFor(user.id))
  if (!isDate(anchor)) {
    return NextResponse.json({ error: 'Use a YYYY-MM-DD date' }, { status: 400 })
  }

  return NextResponse.json(
    week !== null ? await getWeekView(user.id, anchor) : await getDayView(user.id, anchor)
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
