import { redirect } from 'next/navigation'

import { Onboarding } from '@/components/Onboarding'
import { currentAccount } from '@/lib/api'
import { profileFor } from '@/lib/profile'

/**
 * The one-minute setup, shown to a signed-in account that has not finished it.
 *
 * An account that is already onboarded is sent straight to the app, so the
 * flow cannot be reopened by typing the URL.
 */
export default async function OnboardingPage() {
  const account = await currentAccount()
  if (!account) redirect('/signin')

  const profile = await profileFor(account.id)
  if (profile.onboarded) redirect('/')

  return (
    <Onboarding
      initial={{
        wake: profile.wake,
        sleep: profile.sleep,
        persona: profile.persona,
        goals: profile.goals,
      }}
    />
  )
}
