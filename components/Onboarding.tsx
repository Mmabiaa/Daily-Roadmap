'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import type { MustDo, Persona } from '@/lib/models'
import {
    GOAL_PRESETS,
    MUST_DO_MAX,
    MUST_DO_MIN,
    MUST_DO_OPTIONS,
    PERSONA_OPTIONS,
} from '@/lib/preferences'
import { haptic } from '@/lib/utils'

type Initial = {
    wake: string
    sleep: string
    persona: Persona
    goals: string[]
}

const STEPS = ['Your day', 'Who you are', 'Your classes', 'Your goals', 'Minimum day', 'Your week']

/**
 * The one-minute setup: six small steps that end with a drafted week.
 *
 * The answers go up in a single `POST /api/onboarding`, which writes the
 * profile and drafts the starter plan. A pasted timetable is imported *after*
 * that, so the draft is not stopped by classes already existing — and a failed
 * import never costs the person their finished setup.
 */
export function Onboarding({ initial }: { initial: Initial }) {
    const [step, setStep] = useState(0)
    const [wake, setWake] = useState(initial.wake)
    const [sleep, setSleep] = useState(initial.sleep)
    const [persona, setPersona] = useState<Persona>(initial.persona)
    const [goals, setGoals] = useState<string[]>(initial.goals)
    const [table, setTable] = useState('')
    const [essentials, setEssentials] = useState<MustDo[]>([])
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    const sameTimes = wake === sleep
    const picks = essentials.length
    const stepReady =
        step === 0 ? !sameTimes
            : step === 4 ? picks >= MUST_DO_MIN && picks <= MUST_DO_MAX
                : true

    const toggleGoal = (goal: string) =>
        setGoals((list) => (list.includes(goal) ? list.filter((g) => g !== goal) : [...list, goal]))

    const toggleEssentials = (id: MustDo) =>
        setEssentials((list) =>
            list.includes(id)
                ? list.filter((x) => x !== id)
                : list.length < MUST_DO_MAX
                    ? [...list, id]
                    : list
        )

    const next = () => {
        haptic(5)
        setError('')
        setStep((s) => Math.min(s + 1, STEPS.length - 1))
    }

    const back = () => {
        haptic(4)
        setError('')
        setStep((s) => Math.max(s - 1, 0))
    }

    const finish = async () => {
        if (busy) return
        setBusy(true)
        setError('')
        haptic(8)

        try {
            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wake, sleep, persona, goals, essentials }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error || 'We could not set up your plan')
                setBusy(false)
                return
            }

            // Classes go on top of the drafted week. If this fails, the setup
            // still stands — the classes can be pasted again from Settings.
            if (table.trim()) {
                await fetch('/api/timetable', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: table, replace: true }),
                }).catch(() => { })
            }

            window.location.replace('/')
        } catch {
            setError('Something went wrong. Try again.')
            setBusy(false)
        }
    }

    return (
        <main className="onboard-page">
            <section className="onboard-card">
                <header className="onboard-head">
                    <div className="onboard-head-copy">
                        <p className="section-kicker">Set up in a minute</p>
                        <h1>{STEPS[step]}</h1>
                    </div>
                    <div className="onboard-logo">
                        <Image
                            src="https://i.pinimg.com/1200x/f8/98/bf/f898bfb34a80f0784e1417c86a096e13.jpg"
                            alt=""
                            width={44}
                            height={44}
                            priority
                        />
                    </div>
                </header>

                <ol className="onboard-steps" aria-label="Setup progress">
                    {STEPS.map((label, i) => (
                        <li
                            key={label}
                            className={i === step ? 'current' : i < step ? 'done' : ''}
                            aria-current={i === step ? 'step' : undefined}
                        />
                    ))}
                </ol>

                <div className="onboard-body">
                    {step === 0 && (
                        <div className="onboard-step">
                            <p className="onboard-lead">
                                Your wake and sleep times are the frame the rest of the day is
                                built around.
                            </p>
                            <div className="time-row">
                                <label className="ob-field">
                                    <span>I wake up at</span>
                                    <input
                                        type="time"
                                        value={wake}
                                        onChange={(e) => setWake(e.target.value)}
                                    />
                                </label>
                                <label className="ob-field">
                                    <span>I go to sleep at</span>
                                    <input
                                        type="time"
                                        value={sleep}
                                        onChange={(e) => setSleep(e.target.value)}
                                    />
                                </label>
                            </div>
                            {sameTimes && (
                                <p className="onboard-error" role="alert">
                                    Wake and sleep need to be different times.
                                </p>
                            )}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="onboard-step">
                            <p className="onboard-lead">
                                This only changes the shape of the day we draft for you. You can
                                change it any time.
                            </p>
                            <div className="choice-list" role="radiogroup" aria-label="What kind of day">
                                {PERSONA_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={persona === option.id}
                                        className={`choice ${persona === option.id ? 'selected' : ''}`}
                                        onClick={() => {
                                            haptic(4)
                                            setPersona(option.id)
                                        }}
                                    >
                                        <strong>{option.label}</strong>
                                        <span>{option.blurb}</span>
                                        {persona === option.id && <Check aria-hidden="true" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="onboard-step">
                            <p className="onboard-lead">
                                Add your classes or work hours now, or skip and add them later in
                                Settings.
                            </p>
                            <label className="ob-field">
                                <span>Your timetable</span>
                                <textarea
                                    value={table}
                                    onChange={(e) => setTable(e.target.value)}
                                    rows={7}
                                    spellCheck={false}
                                    placeholder={'One line per class, for example:\nMon, Wed 08:30-10:00 Data Communication\nTue 13:00-15:00 Networks'}
                                />
                            </label>
                            <p className="ob-hint">
                                Days and a time range on each line is all we need. Nothing to
                                import? Leave it blank and tap Continue.
                            </p>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="onboard-step">
                            <p className="onboard-lead">What do you want more of? Pick any.</p>
                            <div className="chip-row">
                                {GOAL_PRESETS.map((goal) => (
                                    <button
                                        key={goal}
                                        type="button"
                                        aria-pressed={goals.includes(goal)}
                                        className={`chip ${goals.includes(goal) ? 'selected' : ''}`}
                                        onClick={() => {
                                            haptic(4)
                                            toggleGoal(goal)
                                        }}
                                    >
                                        {goal}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="onboard-step">
                            <p className="onboard-lead">
                                Pick {MUST_DO_MIN} to {MUST_DO_MAX}. On a hard day these are the only
                                things that count — your Minimum day.
                            </p>
                            <div className="choice-list">
                                {MUST_DO_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        aria-pressed={essentials.includes(option.id)}
                                        className={`choice compact ${essentials.includes(option.id) ? 'selected' : ''}`}
                                        onClick={() => {
                                            haptic(4)
                                            toggleEssentials(option.id)
                                        }}
                                    >
                                        <span className="choice-text">
                                            <strong>{option.label}</strong>
                                            <span>{option.hint}</span>
                                        </span>
                                        {essentials.includes(option.id) && <Check aria-hidden="true" />}
                                    </button>
                                ))}
                            </div>
                            <p className="ob-hint">{picks} of {MUST_DO_MAX} picked</p>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="onboard-step">
                            <div className="onboard-done">
                                <Sparkles aria-hidden="true" />
                                <p>Your week is ready — and everything in it can be changed.</p>
                            </div>
                            <dl className="summary-list">
                                <div>
                                    <dt>Awake</dt>
                                    <dd>{wake} – {sleep}</dd>
                                </div>
                                <div>
                                    <dt>Kind of day</dt>
                                    <dd>{PERSONA_OPTIONS.find((p) => p.id === persona)?.label}</dd>
                                </div>
                                <div>
                                    <dt>Classes</dt>
                                    <dd>{table.trim() ? 'Added with your setup' : 'None yet'}</dd>
                                </div>
                                <div>
                                    <dt>Goals</dt>
                                    <dd>{goals.length ? goals.join(', ') : 'None picked'}</dd>
                                </div>
                                <div>
                                    <dt>Minimum day</dt>
                                    <dd>
                                        {essentials
                                            .map((id) => MUST_DO_OPTIONS.find((o) => o.id === id)?.label)
                                            .join(' · ')}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    )}
                </div>

                {error && (
                    <p className="onboard-error" role="alert">
                        {error}
                    </p>
                )}

                <div className="onboard-actions">
                    {step > 0 && (
                        <button type="button" className="onboard-back" onClick={back} disabled={busy}>
                            <ArrowLeft aria-hidden="true" />
                            Back
                        </button>
                    )}
                    {step < STEPS.length - 1 ? (
                        <button
                            type="button"
                            className="onboard-next"
                            onClick={next}
                            disabled={!stepReady}
                        >
                            Continue
                            <ArrowRight aria-hidden="true" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="onboard-next"
                            onClick={finish}
                            disabled={busy}
                        >
                            {busy && <span className="signin-spinner" aria-hidden="true" />}
                            {busy ? 'Building your week…' : 'Start my plan'}
                        </button>
                    )}
                </div>
            </section>
        </main>
    )
}
