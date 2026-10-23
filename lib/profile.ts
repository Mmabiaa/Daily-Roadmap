/**
 * The account's own choices, kept in one `profiles` document.
 *
 * Everything here is server-scoped by the owner id `requireUser()` handed over,
 * so another account's profile can never be read or written. The document is
 * merged over the defaults on the way out, which means a field added later
 * arrives with a sane value instead of `undefined`.
 */

import { getDb, ensureIndexes } from './mongodb.ts'
import { phoneRules, studyRules } from './schedule.ts'
import type { Profile, ProfileUpdate, Rules } from './models.ts'

const PROFILES = 'profiles'

/** The guardrails a new account starts with: the ones the app has always shown. */
const DEFAULT_RULES: Rules = { phone: [...phoneRules], study: [...studyRules] }

/** What a profile says before the account has changed anything. */
export const DEFAULT_PROFILE: Omit<Profile, 'userId'> = {
  onboarded: false,
  wake: '06:30',
  sleep: '22:30',
  persona: 'student',
  goals: [],
  clock: '24',
  reminders: { enabled: true, lead: 10 },
  rules: DEFAULT_RULES,
}

/**
 * The account's profile, always answering with every field filled.
 *
 * A missing document is *not* treated as "needs onboarding": accounts created
 * before profiles existed (the seeded one included) would otherwise be sent
 * through a flow they never asked for. Only a document that says
 * `onboarded: false` means the flow is still owed — and one is written for
 * every new sign-up.
 */
export async function profileFor(userId: string): Promise<Profile> {
  const db = await getDb()
  const doc = await db.collection(PROFILES).findOne({ userId })
  if (!doc) return { userId, ...DEFAULT_PROFILE, onboarded: true }

  return {
    userId,
    onboarded: Boolean(doc.onboarded),
    wake: typeof doc.wake === 'string' ? doc.wake : DEFAULT_PROFILE.wake,
    sleep: typeof doc.sleep === 'string' ? doc.sleep : DEFAULT_PROFILE.sleep,
    persona: doc.persona ?? DEFAULT_PROFILE.persona,
    goals: Array.isArray(doc.goals) ? doc.goals : [],
    clock: doc.clock === '12' ? '12' : '24',
    reminders: {
      enabled: doc.reminders?.enabled ?? DEFAULT_PROFILE.reminders.enabled,
      lead: typeof doc.reminders?.lead === 'number' ? doc.reminders.lead : DEFAULT_PROFILE.reminders.lead,
    },
    rules: {
      phone: Array.isArray(doc.rules?.phone) ? doc.rules.phone : DEFAULT_RULES.phone,
      study: Array.isArray(doc.rules?.study) ? doc.rules.study : DEFAULT_RULES.study,
    },
  }
}

/** Applies a change to the account's profile, creating the document if needed. */
export async function saveProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  const db = await getDb()
  await ensureIndexes()

  const set: Record<string, unknown> = { updatedAt: new Date() }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value
  }

  // A single upsert cannot name the same path in `$set` and `$setOnInsert` —
  // MongoDB refuses it outright (code 40, "would create a conflict"). So the
  // insert defaults are seeded by subtraction: anything the patch already
  // carries is dropped from the insert side and left to `$set`.
  const insert: Record<string, unknown> = {
    userId,
    ...DEFAULT_PROFILE,
    onboarded: true,
    createdAt: new Date(),
  }
  for (const key of Object.keys(set)) delete insert[key]

  await db.collection(PROFILES).updateOne(
    { userId },
    { $set: set, $setOnInsert: insert },
    { upsert: true }
  )

  return profileFor(userId)
}

/** Marks onboarding finished, once the first week has been written. */
export async function markOnboarded(userId: string): Promise<void> {
  const db = await getDb()
  await db.collection(PROFILES).updateOne(
    { userId },
    { $set: { onboarded: true, updatedAt: new Date() } },
    { upsert: true }
  )
}
