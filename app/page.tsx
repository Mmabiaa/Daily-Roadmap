import { AppShell } from '@/components/AppShell'

export default async function Page() {
  // Auth is enforced by proxy.ts — only authenticated users reach here
  return <AppShell />
}