import { redirect } from 'next/navigation'

import { AppShell } from '@/components/AppShell'
import { currentAccount } from '@/lib/api'
import { profileFor } from '@/lib/profile'

export default async function Page() {
  // Auth is enforced by proxy.ts — only authenticated users reach here.
  const account = await currentAccount()
  if (!account) redirect('/signin')

  // An account that has not finished the one-minute setup is sent back to the
  // sign-in page rather than straight into the flow: setup is entered from
  // there, so opening the app can never drop someone into it unannounced.
  // Accounts from before profiles existed read as onboarded, so an existing
  // user goes straight through to the app.
  const profile = await profileFor(account.id)
  if (!profile.onboarded) redirect('/signin')

  return <AppShell />
}
