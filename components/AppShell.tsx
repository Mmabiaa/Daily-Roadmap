'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { days, type Category, type Day } from '@/lib/schedule'
import type { Kind, Profile, Repeat, Rules } from '@/lib/models'
import { lowEnergyRun } from '@/lib/preferences'
import {
    dayStatus,
    type BlockView,
    type DayBlock,
    type DayStatus,
    type WeekView as WeekData,
} from '@/lib/resolver'
import { durationMinutes, minutesOf, weekdayOf } from '@/lib/schedule-time'
import { haptic } from '@/lib/utils'

import { BottomNav } from './BottomNav'
import { FocusMode } from './FocusMode'
import { Guide } from './Guide'
import { Review } from './Review'
import { Settings } from './Settings'
import { TodayView } from './TodayView'
import { Topbar } from './Topbar'
import { WeekView } from './WeekView'
import { Toast } from './Toast'
import { Confetti } from './Confetti'
import FloatingActionButton from './FloatingActionButton'
import EventFormModal, { type EditTarget } from './EventFormModal'

type View = 'today' | 'week' | 'review' | 'guide' | 'settings'

type EnergyLevel = 'low' | 'okay' | 'high'

/** A stored event as `GET /api/events` returns it — just the fields the form needs. */
type ListedEvent = {
    _id: string
    title: string
    category: Category
    kind: Kind
    start: string
    end: string
    essential: boolean
    repeat: Repeat
    startDate?: string
    endDate?: string
    note?: string
}

type StoredProgress = {
    reviews: Record<string, string[]>
    energy: Record<string, 'low' | 'okay' | 'high'>
    theme: 'light' | 'dark' | null
}

/** Entries that differ between the last saved snapshot and the current state. */
const changed = <T,>(prev: Record<string, T>, next: Record<string, T>): Record<string, T> => {
    const out: Record<string, T> = {}
    for (const [key, value] of Object.entries(next)) {
        if (JSON.stringify(prev[key]) !== JSON.stringify(value)) out[key] = value
    }
    return out
}

/** Shown while the signed-in user's own schedule is still loading. */
function ScheduleSkeleton() {
    return (
        <main className="content" role="status" aria-label="Loading your schedule">
            <div className="skeleton-card" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div className="skeleton-row" key={i}>
                        <span className="skeleton-line skeleton-line--time" />
                        <span className="skeleton-line skeleton-line--title" />
                    </div>
                ))}
            </div>
        </main>
    )
}

/** Shown when the schedule could not be loaded. Offers a retry, never a fake plan. */
function ScheduleErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <main className="content">
            <div className="empty-state" role="alert">
                <p>We couldn’t load your schedule.</p>
                <p className="empty-hint">
                    Your plan is safe on the server — this looks like a connection problem.
                </p>
                <button type="button" className="empty-action" onClick={onRetry}>
                    Try again
                </button>
            </div>
        </main>
    )
}

export function AppShell() {
    const [view, setView] = useState<View>('today')
    const [selectedDay, setSelectedDay] = useState<Day>('Mon')
    const [minimum, setMinimum] = useState(false)
    const [reviews, setReviews] = useState<Record<string, string[]>>({})
    const [energy, setEnergy] = useState<Record<string, 'low' | 'okay' | 'high'>>({})
    const [now, setNow] = useState<Date | null>(null)
    const [mounted, setMounted] = useState(false)
    const [theme, setTheme] = useState<'light' | 'dark'>('light')
    const [lockIn, setLockIn] = useState(false)
    const [timer, setTimer] = useState(50 * 60)
    const [timerRunning, setTimerRunning] = useState(false)
    const [toast, setToast] = useState<{ message: string; tone?: 'success' | 'info' } | null>(null)
    const [celebrate, setCelebrate] = useState(false)
    // The account's own choices — wake/sleep, its goals, its guardrails and the
    // reminder rule. Loaded alongside the schedule; the Settings and Guide
    // screens read it, and reminders follow it.
    const [profile, setProfile] = useState<Profile | null>(null)
    // The resolved week comes from the server, so which day is "today", which
    // blocks a date shows and which are ticked are all decided there, not by the
    // browser clock. The raw list is kept only so an edit can name what it opens.
    const [week, setWeek] = useState<WeekData | null>(null)
    const [events, setEvents] = useState<ListedEvent[] | null>(null)
    const [eventsError, setEventsError] = useState(false)
    const [formOpen, setFormOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<EditTarget | null>(null)

    // Progress lives in the database. `loaded` gates persistence until the
    // initial fetch resolves; `saved` is the last snapshot written to the API.
    const loaded = useRef(false)
    const saved = useRef<StoredProgress>({ reviews: {}, energy: {}, theme: null })
    // The week tab opens on the account's own today, but only once.
    const pickedDay = useRef(false)
    // The last block a reminder was already shown for, so it is not repeated.
    const reminded = useRef('')

    // Load the resolved week and the raw event list together. Until they arrive
    // we show a skeleton, and on failure an error with a retry. We never fall
    // back to a bundled plan: the starter schedule belongs to the seeded account.
    const loadSchedule = useCallback(async () => {
        setEventsError(false)
        try {
            const [weekRes, listRes] = await Promise.all([
                fetch('/api/events?week=', { cache: 'no-store' }),
                fetch('/api/events', { cache: 'no-store' }),
            ])
            if (!weekRes.ok || !listRes.ok) throw new Error('Request failed')

            const data: WeekData = await weekRes.json()
            setWeek(data)
            setEvents(await listRes.json())
            if (!pickedDay.current) {
                pickedDay.current = true
                setSelectedDay(weekdayOf(data.today))
            }
        } catch {
            setEventsError(true)
        }
    }, [])

    useEffect(() => {
        loadSchedule()
    }, [loadSchedule])

    // The account's own settings. A failure only means the Settings and Guide
    // tabs have nothing to show yet — the plan itself is unaffected.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/profile', { cache: 'no-store' })
                if (!res.ok) return
                const data = await res.json()
                if (!cancelled) setProfile(data)
            } catch {
                /* offline — retry on the next visit */
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    // Hydrate progress from the database + start the clock AFTER mount
    // (avoids SSR mismatch). Nothing is read from or written to localStorage.
    useEffect(() => {
        setMounted(true)
        setNow(new Date())

        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/progress', { cache: 'no-store' })
                if (!res.ok) return
                const data = await res.json()
                if (cancelled) return
                const next: StoredProgress = {
                    reviews: data.reviews ?? {},
                    energy: data.energy ?? {},
                    theme: data.theme ?? null,
                }
                setReviews(next.reviews)
                setEnergy(next.energy)
                setTheme(
                    next.theme ||
                    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                )
                saved.current = next
            } catch {
                /* offline — keep the empty state and retry on the next edit */
            } finally {
                if (!cancelled) loaded.current = true
            }
        })()

        const id = setInterval(() => setNow(new Date()), 30000)
        return () => {
            cancelled = true
            clearInterval(id)
        }
    }, [])

    // Apply theme
    useEffect(() => {
        if (!mounted) return
        document.documentElement.classList.toggle('dark', theme === 'dark')
    }, [theme, mounted])

    // Persist progress to the database (debounced). Only the entries that
    // actually changed since the last save are sent.
    useEffect(() => {
        if (!loaded.current) return
        const id = setTimeout(() => {
            const prev = saved.current
            const body: Record<string, unknown> = {}

            const reviewsDelta = changed(prev.reviews, reviews)
            if (Object.keys(reviewsDelta).length) body.reviews = reviewsDelta
            const energyDelta = changed(prev.energy, energy)
            if (Object.keys(energyDelta).length) body.energy = energyDelta
            if (prev.theme !== theme) body.theme = theme

            if (Object.keys(body).length === 0) return
            saved.current = { reviews, energy, theme }
            fetch('/api/progress', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).catch(() => {
                /* keep local state; the next change retries the save */
            })
        }, 600)
        return () => clearTimeout(id)
    }, [reviews, energy, theme])

    // Focus timer tick
    useEffect(() => {
        if (!timerRunning) return
        const id = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000)
        return () => clearInterval(id)
    }, [timerRunning])

    // Toast auto-dismiss
    useEffect(() => {
        if (!toast) return
        const id = setTimeout(() => setToast(null), 2200)
        return () => clearTimeout(id)
    }, [toast])

    // Register service worker (production only).
    // We never let the HTTP cache serve sw.js and we reload once when a newly
    // deployed worker takes control, so open tabs move to the latest version.
    useEffect(() => {
        if (!mounted || process.env.NODE_ENV !== 'production') return
        if (!('serviceWorker' in navigator)) return

        const hadController = Boolean(navigator.serviceWorker.controller)
        let reloading = false
        const onControllerChange = () => {
            if (!hadController || reloading) return
            reloading = true
            window.location.reload()
        }
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

        navigator.serviceWorker
            .register('/sw.js', { updateViaCache: 'none' })
            .then((registration) => registration.update().catch(() => { }))
            .catch(() => { })

        return () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
        }
    }, [mounted])

    // ─── Derived values ───
    // Use a "safe now" that's only the real clock once mounted.
    // Before mount: use midnight so server + first client render agree.
    const safeNow = now ?? new Date(2000, 0, 1, 0, 0, 0)
    const todayDay = week ? weekdayOf(week.today) : null
    const activeDay: Day = view === 'today' && todayDay ? todayDay : selectedDay
    const day = week?.days[days.indexOf(activeDay)]
    const date = day?.date ?? ''
    const blocks = day?.blocks ?? []
    const shown = minimum ? blocks.filter((b) => b.essential) : blocks

    const isToday = todayDay !== null && activeDay === todayDay
    const currentMinutes = safeNow.getHours() * 60 + safeNow.getMinutes()
    const status: DayStatus =
        mounted && isToday ? dayStatus(blocks, currentMinutes) : { current: null, next: null, minutesLeft: null }

    const completion = blocks.length
        ? blocks.filter((b) => b.done).length / blocks.length
        : 0

    // A day only counts once it has essentials; an empty schedule must not read
    // as "everything done" (every() on an empty list is true).
    const essentials = blocks.filter((b) => b.essential)
    const essentialDone = essentials.length > 0 && essentials.every((b) => b.done)

    const streak = week?.streak ?? 0

    const classHours = Math.round(
        blocks.reduce((a, b) => a + (b.category === 'class' ? durationMinutes(b.start, b.end) : 0), 0) / 60 * 10
    ) / 10

    const studyHours = Math.round(
        blocks.reduce((a, b) => a + (b.category === 'study' ? durationMinutes(b.start, b.end) : 0), 0) / 60 * 10
    ) / 10

    const focusBlock: DayBlock | undefined = status.current ?? blocks[0]

    const comebacks = week?.comebacks ?? 0
    const todayDate = week?.today ?? ''
    const energyToday = todayDate ? energy[todayDate] ?? null : null
    const lowRun = todayDate ? lowEnergyRun(energy, todayDate) : 0

    // Hours of classes and study across the whole week — the "too full" signal.
    const weekLoad = (week?.days ?? []).reduce(
        (total, d) =>
            total +
            d.blocks.reduce(
                (sum, b) =>
                    sum +
                    (b.category === 'class' || b.category === 'study'
                        ? durationMinutes(b.start, b.end)
                        : 0),
                0
            ),
        0
    ) / 60

    // A nudge before the next block starts, following the account's own lead
    // time. Shown once per block; nothing is sent to a push service.
    useEffect(() => {
        if (!mounted || !profile?.reminders.enabled || !status.next || !date) return
        const mins = minutesOf(status.next.start) - currentMinutes
        if (mins <= 0 || mins > profile.reminders.lead) return

        const key = `${date}:${status.next.eventId}`
        if (reminded.current === key) return
        reminded.current = key
        setToast({ message: `Starting in ${mins} min · ${status.next.title}` })
    }, [mounted, profile, status.next, currentMinutes, date])

    /** Reflect a tick locally so the row answers at once, before the server does. */
    const markDone = (onDate: string, eventId: string, done: boolean) =>
        setWeek((current) =>
            current
                ? {
                    ...current,
                    days: current.days.map((d) =>
                        d.date !== onDate
                            ? d
                            : {
                                ...d,
                                blocks: d.blocks.map((block) =>
                                    block.eventId === eventId ? { ...block, done } : block
                                ),
                            }
                    ),
                }
                : current
        )

    const toggle = (i: number) => {
        const block = blocks[i]
        if (!block || !date) return
        haptic(6)
        const done = !block.done
        markDone(date, block.eventId, done)
        if (done && block.essential) {
            setToast({ message: 'Essential done · nice', tone: 'success' })
        }
        void (async () => {
            try {
                const res = await fetch('/api/completions', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date, eventId: block.eventId, done }),
                })
                // A refused tick means the local guess was wrong; re-read the day.
                if (!res.ok) await loadSchedule()
            } catch {
                await loadSchedule()
            }
        })()
    }

    const handleLockIn = () => {
        const next = !lockIn
        haptic(10)
        setLockIn(next)
        setTimerRunning(next)
    }

    const handleSignOut = async () => {
        try {
            await fetch('/api/auth/signout', { method: 'POST' })
        } catch {
            /* the cookie is cleared server-side; fall through to the redirect */
        }
        window.location.replace('/signin')
    }

    const handleProfile = useCallback((next: Profile) => setProfile(next), [])

    /** The Guide's edit: save the account's own rules, keep them on screen. */
    const handleRules = useCallback(async (rules: Rules) => {
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules }),
            })
            if (res.ok) setProfile(await res.json())
        } catch {
            /* keep what is on screen; the next edit tries again */
        }
    }, [])

    const markEnergy = (level: EnergyLevel) => {
        if (!todayDate) return
        haptic(5)
        setEnergy((current) => ({ ...current, [todayDate]: level }))
    }

    const openNewEvent = () => {
        haptic(6)
        setEditTarget(null)
        setFormOpen(true)
    }

    // A block shows the day it was opened from; the repeating rule and window
    // still belong to the stored event, so both are read to name what to edit.
    const openEditEvent = (block: BlockView) => {
        const source = events?.find((e) => e._id === block.eventId)
        if (!source || !date) return
        haptic(6)
        setEditTarget({
            id: block.eventId,
            date,
            title: block.title,
            category: block.category,
            kind: block.kind,
            start: block.start,
            end: block.end,
            essential: block.essential,
            note: block.note,
            repeat: source.repeat,
            startDate: source.startDate,
            endDate: source.endDate,
        })
        setFormOpen(true)
    }

    // Celebrate when essential day complete
    useEffect(() => {
        if (!mounted) return
        if (essentialDone && view === 'today' && completion > 0) {
            setCelebrate(true)
            const id = setTimeout(() => setCelebrate(false), 1600)
            return () => clearTimeout(id)
        }
    }, [essentialDone, completion, mounted, view])

    // Only compute the formatted subtitle AFTER mount to avoid locale/time mismatch
    const subtitle =
        !mounted
            ? ' '
            : view === 'today'
                ? new Intl.DateTimeFormat('en', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                }).format(safeNow)
                : view === 'week'
                    ? 'A gentle view of the week ahead'
                    : view === 'review'
                        ? 'A quiet Sunday check-in'
                        : view === 'settings'
                            ? 'Your day, your rules'
                            : 'Small rules, made easier to keep'

    return (
        <div className="app-shell">
            <Topbar
                view={view}
                subtitle={subtitle}
                theme={theme}
                lockIn={lockIn}
                onToggleLockIn={handleLockIn}
                onToggleTheme={() => {
                    haptic(5)
                    setTheme(theme === 'light' ? 'dark' : 'light')
                }}
                onSignOut={handleSignOut}
            />

            {lockIn && focusBlock && (
                <FocusMode
                    block={focusBlock}
                    timer={timer}
                    running={timerRunning}
                    onToggle={() => {
                        haptic(6)
                        setTimerRunning((value) => !value)
                    }}
                    onClose={() => {
                        haptic(8)
                        handleLockIn()
                    }}
                    onReset={() => setTimer(50 * 60)}
                />
            )}

            <div className={`page-transition ${view}`}>
                {(view === 'today' || view === 'week') &&
                    (eventsError ? (
                        <ScheduleErrorState onRetry={loadSchedule} />
                    ) : !week ? (
                        <ScheduleSkeleton />
                    ) : view === 'today' ? (
                        <TodayView
                            blocks={blocks}
                            shown={shown}
                            completion={completion}
                            streak={streak}
                            comebacks={comebacks}
                            current={status.current}
                            next={status.next}
                            minutesLeft={status.minutesLeft}
                            minimum={minimum}
                            setMinimum={setMinimum}
                            onToggle={toggle}
                            onEdit={openEditEvent}
                            energyToday={energyToday}
                            onEnergy={markEnergy}
                            lowRun={lowRun}
                            weekLoad={weekLoad}
                            mounted={mounted}
                        />
                    ) : (
                        <WeekView
                            blocks={blocks}
                            shown={shown}
                            selectedDay={selectedDay}
                            setSelectedDay={(d) => {
                                haptic(5)
                                setSelectedDay(d)
                            }}
                            classHours={classHours}
                            studyHours={studyHours}
                            essentialDone={essentialDone}
                            minimum={minimum}
                            setMinimum={setMinimum}
                            onToggle={toggle}
                            onEdit={openEditEvent}
                        />
                    ))}

                {view === 'review' && (
                    <Review
                        reviews={reviews}
                        setReviews={setReviews}
                        onSaved={() => setToast({ message: 'Saved to your account', tone: 'success' })}
                    />
                )}
                {view === 'guide' && profile && (
                    <Guide rules={profile.rules} onRules={handleRules} />
                )}
                {view === 'settings' && profile && (
                    <Settings
                        profile={profile}
                        onProfile={handleProfile}
                        onToast={(message, tone) => setToast({ message, tone })}
                        onSignOut={handleSignOut}
                    />
                )}
            </div>

            {toast && <Toast message={toast.message} tone={toast.tone} />}
            {celebrate && <Confetti />}

            {!lockIn && (view === 'today' || view === 'week') && (
                <FloatingActionButton onClick={openNewEvent} />
            )}

            <EventFormModal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                onSave={() => {
                    setToast({
                        message: editTarget ? 'Event updated' : 'Event added',
                        tone: 'success',
                    })
                    loadSchedule()
                }}
                event={editTarget}
                defaultDay={activeDay}
                defaultDate={date}
            />

            <BottomNav view={view} setView={setView} />
        </div>
    )
}
