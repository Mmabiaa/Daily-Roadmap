import { NextResponse } from 'next/server'

import { route } from '@/lib/api'
import { OnboardingSchema } from '@/lib/models'
import { draftStarterPlan } from '@/lib/onboarding'
import { markOnboarded, profileFor, saveProfile } from '@/lib/profile'
import { importBlocks, listEvents } from '@/lib/schedule-service'

/**
 * Finishes onboarding: saves the answers, drafts the first week, and marks the
 * account onboarded.
 *
 * The week is drafted only when the account has no events of its own, so
 * running the flow again (or a double submit) cannot pile a second plan on top
 * of the first. Blocks the person did not pick as must-dos are still created —
 * they simply are not essential, so they fall away on a Minimum day.
 */
export const POST = route(
  {
    body: OnboardingSchema,
    invalidBody: 'Check your answers and try again',
    failure: 'Failed to set up your plan',
  },
  async ({ user, body }) => {
    await saveProfile(user.id, {
      wake: body.wake,
      sleep: body.sleep,
      persona: body.persona,
      goals: body.goals,
    })

    let created = 0
    if ((await listEvents(user.id)).length === 0) {
      created = (await importBlocks(user.id, draftStarterPlan(body))).created
    }

    await markOnboarded(user.id)
    return NextResponse.json({ ...(await profileFor(user.id)), created }, { status: 201 })
  }
)
