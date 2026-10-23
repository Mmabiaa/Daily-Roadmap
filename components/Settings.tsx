'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
    AtSign,
    Bell,
    Check,
    Clock,
    Copy,
    Globe,
    LogOut,
    Mail,
    Share2,
    Sparkles,
    Sun,
    Upload,
    User,
    type LucideIcon,
} from 'lucide-react'
import type { Clock as ClockValue, Persona, Profile, ProfileUpdate } from '@/lib/models'
import { GOAL_PRESETS, PERSONA_OPTIONS } from '@/lib/preferences'
import { haptic } from '@/lib/utils'

type Props = {
    profile: Profile
    onProfile: (profile: Profile) => void
    onToast: (message: string, tone?: 'success' | 'info') => void
    onSignOut: () => void
}

/** The account's identity — the fields that live on the `users` document. */
type Account = { username: string; email: string; timezone: string }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const LEADS = [0, 5, 10, 15, 30]

/** IANA zones the platform knows, read on the client so server and browser agree. */
function zoneList(current: string): string[] {
    try {
        const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
        const zones = supported ? supported('timeZone') : []
        return Array.from(new Set([current, ...zones])).filter(Boolean).sort()
    } catch {
        return current ? [current] : []
    }
}

/** One titled group of settings. */
function Section({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: LucideIcon
    title: string
    description?: string
    children: ReactNode
}) {
    return (
        <section className="st-card">
            <header className="st-card-head">
                <span className="st-icon" aria-hidden="true">
                    <Icon />
                </span>
                <div>
                    <h3>{title}</h3>
                    {description && <p>{description}</p>}
                </div>
            </header>
            <div className="st-card-body">{children}</div>
        </section>
    )
}

/** A label (with optional helper text) on the left, its control on the right. */
function Row({
    title,
    hint,
    children,
}: {
    title: string
    hint?: string
    children: ReactNode
}) {
    return (
        <div className="st-row">
            <div className="st-row-text">
                <span className="st-row-title">{title}</span>
                {hint && <span className="st-row-hint">{hint}</span>}
            </div>
            <div className="st-row-control">{children}</div>
        </div>
    )
}

function Switch({
    on,
    label,
    onToggle,
}: {
    on: boolean
    label: string
    onToggle: () => void
}) {
    return (
        <button
            type="button"
            className={`st-switch ${on ? 'on' : ''}`}
            role="switch"
            aria-checked={on}
            aria-label={label}
            onClick={onToggle}
        >
            <span />
        </button>
    )
}

/**
 * The account's own settings: the day's frame, who it is, its goals, the clock
 * the screens read, reminders, and the class-timetable tools.
 *
 * Edits are saved on their own, shortly after you stop changing a field, so
 * there is no save button to forget. Only the fields that actually differ from
 * what the server last confirmed are sent.
 */
export function Settings({ profile, onProfile, onToast, onSignOut }: Props) {
    const [draft, setDraft] = useState<Profile>(profile)
    const [saved, setSaved] = useState(false)

    // The account's identity is loaded on its own, so a slow read never holds
    // the rest of the screen back.
    const [account, setAccount] = useState<Account | null>(null)
    const [email, setEmail] = useState('')
    const [zones, setZones] = useState<string[]>([])
    const [accountBusy, setAccountBusy] = useState('')

    const [table, setTable] = useState('')
    const [replace, setReplace] = useState(true)
    const [code, setCode] = useState('')
    const [enterCode, setEnterCode] = useState('')
    const [working, setWorking] = useState('')

    // Persist the difference, once the typing pauses.
    useEffect(() => {
        const patch: ProfileUpdate = {}
        if (draft.name !== profile.name) patch.name = draft.name
        if (draft.wake !== profile.wake) patch.wake = draft.wake
        if (draft.sleep !== profile.sleep) patch.sleep = draft.sleep
        if (draft.persona !== profile.persona) patch.persona = draft.persona
        if (!same(draft.goals, profile.goals)) patch.goals = draft.goals
        if (draft.clock !== profile.clock) patch.clock = draft.clock
        if (!same(draft.reminders, profile.reminders)) patch.reminders = draft.reminders
        if (!Object.keys(patch).length) return

        const id = setTimeout(async () => {
            try {
                const res = await fetch('/api/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch),
                })
                if (!res.ok) return
                onProfile(await res.json())
                setSaved(true)
            } catch {
                /* keep the change on screen; the next edit tries again */
            }
        }, 600)
        return () => clearTimeout(id)
    }, [draft, profile, onProfile])

    useEffect(() => {
        if (!saved) return
        const id = setTimeout(() => setSaved(false), 1600)
        return () => clearTimeout(id)
    }, [saved])

    // Read the account's identity once, then offer the platform's zones.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/account', { cache: 'no-store' })
                if (!res.ok) return
                const data: Account = await res.json()
                if (cancelled) return
                setAccount(data)
                setEmail(data.email)
                setZones(zoneList(data.timezone))
            } catch {
                /* offline — the rest of Settings still works */
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    /** Save the account's own fields, then keep the answer on screen. */
    const saveAccount = async (change: { email?: string; timezone?: string }, field: string) => {
        if (!account || accountBusy) return
        setAccountBusy(field)
        try {
            const res = await fetch('/api/account', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(change),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                onToast(data.error || 'We could not save that')
                setEmail(account.email)
                return
            }
            haptic(6)
            setAccount(data)
            setEmail(data.email)
            onToast('Saved to your account', 'success')
        } catch {
            onToast('We could not save that')
            setEmail(account.email)
        } finally {
            setAccountBusy('')
        }
    }

    const patch = (part: Partial<Profile>) => setDraft((d) => ({ ...d, ...part }))

    const toggleGoal = (goal: string) => {
        haptic(4)
        patch({
            goals: draft.goals.includes(goal)
                ? draft.goals.filter((g) => g !== goal)
                : [...draft.goals, goal],
        })
    }

    const importTimetable = async () => {
        if (!table.trim() || working) return
        setWorking('table')
        try {
            const res = await fetch('/api/timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: table, replace }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                onToast(data.error || 'We could not read that timetable')
                return
            }
            haptic(8)
            setTable('')
            onToast(`Added ${data.created} classes`, 'success')
        } catch {
            onToast('We could not read that timetable')
        } finally {
            setWorking('')
        }
    }

    const makeCode = async () => {
        if (working) return
        setWorking('share')
        try {
            const res = await fetch('/api/timetable/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                onToast(data.error || 'Add some classes first')
                return
            }
            haptic(8)
            setCode(data.code)
            onToast('Code ready — share it with your class', 'success')
        } catch {
            onToast('We could not make a code')
        } finally {
            setWorking('')
        }
    }

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(code)
            onToast('Code copied', 'success')
        } catch {
            /* the code is on screen to read out either way */
        }
    }

    const importFromCode = async () => {
        const trimmed = enterCode.trim().toUpperCase()
        if (!trimmed || working) return
        setWorking('import')
        try {
            const res = await fetch('/api/timetable/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: trimmed }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                onToast(data.error || 'That code did not work')
                return
            }
            haptic(8)
            setEnterCode('')
            onToast(`Added ${data.created} classes`, 'success')
        } catch {
            onToast('That code did not work')
        } finally {
            setWorking('')
        }
    }

    const goalChoices = Array.from(new Set([...GOAL_PRESETS, ...draft.goals]))
    const initial = (draft.name.trim() || account?.username || '').charAt(0).toUpperCase()

    return (
        <main className="content st-page">
            {/* Identity header */}
            <header className="st-hero">
                <div className="st-avatar" aria-hidden="true">
                    {initial || <User />}
                </div>
                <div className="st-hero-text">
                    <h2>{draft.name.trim() || 'Your account'}</h2>
                    <p>{account ? `@${account.username}` : ' '}</p>
                </div>
            </header>

            <div className="st-grid">
                <div className="st-col">
                    <Section icon={User} title="Profile" description="How you appear and where we reach you.">
                        <label className="st-field">
                            <span>Your name</span>
                            <input
                                value={draft.name}
                                onChange={(e) => patch({ name: e.target.value })}
                                placeholder="What should we call you?"
                                maxLength={60}
                            />
                        </label>

                        <Row title="Username">
                            <span className="st-value">
                                <AtSign aria-hidden="true" />
                                {account?.username ?? '…'}
                            </span>
                        </Row>

                        <label className="st-field">
                            <span>
                                <Mail aria-hidden="true" /> Email
                            </span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onBlur={() => {
                                    if (account && email.trim() && email !== account.email) {
                                        saveAccount({ email }, 'email')
                                    }
                                }}
                                placeholder="you@example.com"
                                autoComplete="email"
                                disabled={!account}
                            />
                            <small>PIN reset codes are sent here.</small>
                        </label>

                        <label className="st-field">
                            <span>
                                <Globe aria-hidden="true" /> Time zone
                            </span>
                            <select
                                value={account?.timezone ?? ''}
                                onChange={(e) => saveAccount({ timezone: e.target.value }, 'timezone')}
                                disabled={!account || accountBusy === 'timezone'}
                            >
                                {(account ? zones : []).map((zone) => (
                                    <option key={zone} value={zone}>
                                        {zone}
                                    </option>
                                ))}
                            </select>
                            <small>
                                Block times use this clock, so they match the hour you are actually
                                living in.
                            </small>
                        </label>
                    </Section>

                    <Section icon={Sun} title="Your day" description="The frame your schedule is built inside.">
                        <div className="st-pair">
                            <label className="st-field">
                                <span>Wake up</span>
                                <input
                                    type="time"
                                    value={draft.wake}
                                    onChange={(e) => patch({ wake: e.target.value })}
                                />
                            </label>
                            <label className="st-field">
                                <span>Sleep</span>
                                <input
                                    type="time"
                                    value={draft.sleep}
                                    onChange={(e) => patch({ sleep: e.target.value })}
                                />
                            </label>
                        </div>
                        {draft.wake === draft.sleep && (
                            <p className="st-error" role="alert">
                                Wake and sleep need to be different times.
                            </p>
                        )}

                        <Row title="Clock format" hint="How times are shown across the app.">
                            <div className="st-seg" role="group" aria-label="Clock format">
                                {(['24', '12'] as ClockValue[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={draft.clock === value}
                                        onClick={() => {
                                            haptic(4)
                                            patch({ clock: value })
                                        }}
                                    >
                                        {value === '24' ? '24-hour' : '12-hour'}
                                    </button>
                                ))}
                            </div>
                        </Row>
                    </Section>

                    <Section icon={Sparkles} title="Your focus" description="Shapes the kind of day we plan with you.">
                        <label className="st-field">
                            <span>Kind of day</span>
                            <select
                                value={draft.persona}
                                onChange={(e) => patch({ persona: e.target.value as Persona })}
                            >
                                {PERSONA_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="st-field">
                            <span id="st-goals-label">Goals</span>
                            <div className="chip-row" role="group" aria-labelledby="st-goals-label">
                                {goalChoices.map((goal) => (
                                    <button
                                        key={goal}
                                        type="button"
                                        aria-pressed={draft.goals.includes(goal)}
                                        className={`chip ${draft.goals.includes(goal) ? 'selected' : ''}`}
                                        onClick={() => toggleGoal(goal)}
                                    >
                                        {goal}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </Section>
                </div>

                <div className="st-col">
                    <Section
                        icon={Bell}
                        title="Reminders"
                        description="Shown inside the app while it is open — no notifications to allow."
                    >
                        <Row title="Nudge me before a block" hint="A quiet heads-up when something is about to start.">
                            <Switch
                                on={draft.reminders.enabled}
                                label="Reminders"
                                onToggle={() => {
                                    haptic(5)
                                    patch({
                                        reminders: { ...draft.reminders, enabled: !draft.reminders.enabled },
                                    })
                                }}
                            />
                        </Row>
                        {draft.reminders.enabled && (
                            <Row title="How early">
                                <select
                                    className="st-select"
                                    aria-label="How early to remind you"
                                    value={draft.reminders.lead}
                                    onChange={(e) =>
                                        patch({
                                            reminders: { ...draft.reminders, lead: Number(e.target.value) },
                                        })
                                    }
                                >
                                    {LEADS.map((lead) => (
                                        <option key={lead} value={lead}>
                                            {lead === 0 ? 'Right on time' : `${lead} min before`}
                                        </option>
                                    ))}
                                </select>
                            </Row>
                        )}
                    </Section>

                    <Section
                        icon={Upload}
                        title="Class timetable"
                        description="Paste your classes, one per line, and we will add them to your week."
                    >
                        <label className="st-field">
                            <span>Your classes</span>
                            <textarea
                                value={table}
                                onChange={(e) => setTable(e.target.value)}
                                rows={6}
                                spellCheck={false}
                                placeholder={'Mon, Wed 08:30-10:00 Data Communication\nTue 13:00-15:00 Networks'}
                            />
                        </label>
                        <Row title="Replace my current classes" hint="Turn off to keep existing classes and add these.">
                            <Switch
                                on={replace}
                                label="Replace my current classes"
                                onToggle={() => {
                                    haptic(5)
                                    setReplace((v) => !v)
                                }}
                            />
                        </Row>
                        <button
                            type="button"
                            className="st-button"
                            onClick={importTimetable}
                            disabled={!table.trim() || working === 'table'}
                        >
                            {working === 'table' ? 'Reading…' : 'Add these classes'}
                        </button>
                    </Section>

                    <Section
                        icon={Share2}
                        title="Share with classmates"
                        description="Classmates get your classes and add their own plans — nobody sees anyone else’s."
                    >
                        <div className="st-field">
                            <span>Your share code</span>
                            {code ? (
                                <button type="button" className="st-code" onClick={copyCode}>
                                    <strong>{code}</strong>
                                    <small>
                                        <Copy aria-hidden="true" /> Tap to copy
                                    </small>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="st-button st-button-quiet"
                                    onClick={makeCode}
                                    disabled={working === 'share'}
                                >
                                    {working === 'share' ? 'Making a code…' : 'Get a share code'}
                                </button>
                            )}
                        </div>

                        <div className="st-field">
                            <span>Have a code from a classmate?</span>
                            <div className="st-import">
                                <input
                                    value={enterCode}
                                    onChange={(e) => setEnterCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    placeholder="ABC123"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    spellCheck={false}
                                    aria-label="Classmate's share code"
                                />
                                <button
                                    type="button"
                                    className="st-button"
                                    onClick={importFromCode}
                                    disabled={enterCode.trim().length !== 6 || working === 'import'}
                                >
                                    {working === 'import' ? 'Importing…' : 'Import'}
                                </button>
                            </div>
                        </div>
                    </Section>
                </div>
            </div>

            <button type="button" className="st-signout" onClick={onSignOut}>
                <LogOut aria-hidden="true" />
                Sign out
            </button>

            <p className={`st-status ${saved ? 'is-active' : ''}`} role="status" aria-live="polite">
                {saved ? (
                    <>
                        <Check aria-hidden="true" /> Saved to your account
                    </>
                ) : (
                    'Changes save on their own'
                )}
            </p>
        </main>
    )
}