import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { ShareCreateSchema } from '@/lib/models'
import { createShare } from '@/lib/sharing'

/**
 * Makes a short code for the caller's current class timetable.
 *
 * Only the `class` events are copied into the share, as they are right now, so
 * classmates get the timetable and nothing else — never the personal plan
 * behind it, and not even a later edit to the classes themselves.
 */
export const POST = route(
  {
    body: ShareCreateSchema,
    invalidBody: 'Check the label and try again',
    failure: 'Failed to create a share code',
  },
  async ({ user, body }) =>
    NextResponse.json(await createShare(user.id, body.label), { status: 201 })
)
