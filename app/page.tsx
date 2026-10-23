import { redirect } from 'next/navigation'

import { AppShell } from '@/components/AppShell'
import { currentAccount } from '@/lib/api'
import { profileFor } from '@/lib/profile'

export default async function Page() {
  // Auth is enforced by proxy.ts — only authenticated users reach here.
  const account = await currentAccount()
  if (!account) redirect('/signin')

  // A brand-new account is owed the one-minute setup before it sees the app.
  // Accounts from before profiles existed read as onboarded, so only a
  // sign-up that has not finished the flow is redirected.
  const profile = await profileFor(account.id)
  if (!profile.onboarded) redirect('/onboarding')

  return <AppShell />
}
