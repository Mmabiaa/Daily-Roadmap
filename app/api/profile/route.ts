import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { ProfileUpdateSchema } from '@/lib/models'
import { profileFor, saveProfile } from '@/lib/profile'

/**
 * The signed-in account's own profile: wake and sleep times, persona, goals,
 * the screen's clock, reminder settings and its guardrails.
 *
 * It is created for every new sign-up, so a missing document only ever means an
 * account from before profiles existed — `profileFor` answers those with sane
 * defaults and no onboarding owed.
 */
export const GET = route({ failure: 'Failed to load your settings' }, async ({ user }) =>
  NextResponse.json(await profileFor(user.id))
)

export const PATCH = route(
  {
    body: ProfileUpdateSchema,
    invalidBody: 'Check your settings and try again',
    failure: 'Failed to save your settings',
  },
  async ({ user, body }) => NextResponse.json(await saveProfile(user.id, body))
)
