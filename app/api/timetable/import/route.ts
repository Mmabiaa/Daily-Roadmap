import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { ShareImportSchema } from '@/lib/models'
import { importShare } from '@/lib/sharing'

/**
 * Copies a shared class timetable onto the caller's account.
 *
 * The caller's own classes are replaced, so importing twice does not double
 * them; everything else they have planned is left untouched, and they add
 * their personal plans on top of the classes just as the sharing student did.
 */
export const POST = route(
  {
    body: ShareImportSchema,
    invalidBody: 'Enter the 6-character code',
    failure: 'Failed to import the timetable',
  },
  async ({ user, body }) => NextResponse.json(await importShare(user.id, body.code))
)
