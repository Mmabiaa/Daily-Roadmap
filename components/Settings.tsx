'use client'

import { useEffect, useState } from 'react'
import { Bell, Clock, LogOut, Share2, Sun, Upload, User } from 'lucide-react'
import type { Clock as ClockValue, Persona, Profile, ProfileUpdate } from '@/lib/models'
import { GOAL_PRESETS, PERSONA_OPTIONS } from '@/lib/preferences'
import { haptic } from '@/lib/utils'

type Props = {
    profile: Profile
    onProfile: (profile: Profile) => void
    onToast: (message: string, tone?: 'success' | 'info') => void
    onSignOut: () => void
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const LEADS = [0, 5, 10, 15, 30]

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

    const [table, setTable] = useState('')
    const [replace, setReplace] = useState(true)
    const [code, setCode] = useState('')
    const [enterCode, setEnterCode] = useState('')
    const [working, setWorking] = useState('')

    // Persist the difference, once the typing pauses.
    useEffect(() => {
        const patch: ProfileUpdate = {}
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

    return (
        <main className="content settings-page">
            <section className="settings-card">
                <h3>
                    <Sun /> Your day
                </h3>
                <div className="time-row">
                    <label className="ob-field">
                        <span>Wake up</span>
                        <input
                            type="time"
                            value={draft.wake}
                            onChange={(e) => patch({ wake: e.target.value })}
                        />
                    </label>
                    <label className="ob-field">
                        <span>Sleep</span>
                        <input
                            type="time"
                            value={draft.sleep}
                            onChange={(e) => patch({ sleep: e.target.value })}
                        />
                    </label>
                </div>
                {draft.wake === draft.sleep && (
                    <p className="onboard-error" role="alert">
                        Wake and sleep need to be different times.
                    </p>
                )}

                <div className="settings-row">
                    <span className="settings-label">
                        <Clock aria-hidden="true" />
                        Clock
                    </span>
                    <div className="segmented" role="group" aria-label="Clock format">
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
                </div>
            </section>

            <section className="settings-card">
                <h3>
                    <User /> Who you are
                </h3>
                <label className="ob-field">
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

                <p className="settings-sub">Goals</p>
                <div className="chip-row">
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
            </section>

            <section className="settings-card">
                <h3>
                    <Bell /> Reminders
                </h3>
                <div className="settings-row">
                    <span className="settings-label">Nudge me before a block</span>
                    <button
                        type="button"
                        className={`switch ${draft.reminders.enabled ? 'on' : ''}`}
                        role="switch"
                        aria-checked={draft.reminders.enabled}
                        aria-label="Reminders"
                        onClick={() => {
                            haptic(5)
                            patch({ reminders: { ...draft.reminders, enabled: !draft.reminders.enabled } })
                        }}
                    >
                        <span />
                    </button>
                </div>
                {draft.reminders.enabled && (
                    <div className="settings-row">
                        <span className="settings-label">How early</span>
                        <select
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
                    </div>
                )}
                <p className="settings-hint">
                    Reminders show inside the app while it is open — no notifications to allow.
                </p>
            </section>

            <section className="settings-card">
                <h3>
                    <Upload /> Class timetable
                </h3>
                <label className="ob-field">
                    <span>Paste your classes</span>
                    <textarea
                        value={table}
                        onChange={(e) => setTable(e.target.value)}
                        rows={6}
                        spellCheck={false}
                        placeholder={'Mon, Wed 08:30-10:00 Data Communication\nTue 13:00-15:00 Networks'}
                    />
                </label>
                <div className="settings-row">
                    <span className="settings-label">Replace my current classes</span>
                    <button
                        type="button"
                        className={`switch ${replace ? 'on' : ''}`}
                        role="switch"
                        aria-checked={replace}
                        aria-label="Replace my current classes"
                        onClick={() => {
                            haptic(5)
                            setReplace((v) => !v)
                        }}
                    >
                        <span />
                    </button>
                </div>
                <button
                    type="button"
                    className="settings-action"
                    onClick={importTimetable}
                    disabled={!table.trim() || working === 'table'}
                >
                    {working === 'table' ? 'Reading…' : 'Add these classes'}
                </button>
            </section>

            <section className="settings-card">
                <h3>
                    <Share2 /> Share with classmates
                </h3>
                <p className="settings-hint">
                    Share your class timetable with a short code. Classmates get the classes and add
                    their own personal plans — nobody sees anyone else&apos;s.
                </p>

                {code ? (
                    <button type="button" className="share-code" onClick={copyCode}>
                        <span>{code}</span>
                        <small>Tap to copy</small>
                    </button>
                ) : (
                    <button
                        type="button"
                        className="settings-action"
                        onClick={makeCode}
                        disabled={working === 'share'}
                    >
                        {working === 'share' ? 'Making a code…' : 'Get a share code'}
                    </button>
                )}

                <div className="settings-row import-row">
                    <input
                        className="code-input"
                        value={enterCode}
                        onChange={(e) => setEnterCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        placeholder="Enter a code"
                        aria-label="Classmate's share code"
                    />
                    <button
                        type="button"
                        className="settings-action compact"
                        onClick={importFromCode}
                        disabled={enterCode.trim().length !== 6 || working === 'import'}
                    >
                        {working === 'import' ? 'Importing…' : 'Import'}
                    </button>
                </div>
            </section>

            <button type="button" className="guide-signout" onClick={onSignOut}>
                <LogOut aria-hidden="true" />
                Sign out
            </button>

            <p className={`saved-note ${saved ? 'is-active' : ''}`}>
                {saved ? 'Saved to your account' : 'Changes save on their own'}
            </p>
        </main>
    )
}
