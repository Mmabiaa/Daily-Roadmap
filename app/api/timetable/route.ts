import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { TimetableSchema } from '@/lib/models'
import { parseTimetable, timetableBlocks } from '@/lib/onboarding'
import { importBlocks } from '@/lib/schedule-service'

/**
 * Reads a pasted timetable into fixed class events.
 *
 * The paste is a line per class — `Mon, Wed 08:30-10:00 CE 481 Data
 * Communication` — with the weekdays anywhere on the line. Lines the parser
 * cannot read are skipped, so a heading or a note is harmless; only a paste
 * with nothing readable at all is refused. With `replace`, the account's
 * existing classes (and their ticks) are cleared first, so a corrected
 * timetable does not stack on the old one.
 */
export const POST = route(
  {
    body: TimetableSchema,
    invalidBody: 'Paste your timetable and try again',
    failure: 'Failed to read your timetable',
  },
  async ({ user, body }) => {
    const classes = parseTimetable(body.text)
    if (classes.length === 0) {
      return NextResponse.json(
        { error: 'No classes found. Use one line per class, e.g. "Mon 08:30-10:00 Networks".' },
        { status: 400 }
      )
    }

    const result = await importBlocks(user.id, timetableBlocks(classes), {
      ...(body.replace ? { replaceCategory: 'class' as const } : {}),
    })

    return NextResponse.json({ ...result, found: classes.length }, { status: 201 })
  }
)
