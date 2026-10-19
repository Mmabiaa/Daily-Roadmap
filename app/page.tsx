import { AppShell } from '@/components/AppShell'

export default async function Page() {
  // Auth is enforced by middleware — only authenticated users reach here
  return <AppShell />
}