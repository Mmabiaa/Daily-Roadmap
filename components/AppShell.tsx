'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Block, Day, days, schedule } from '@/lib/schedule'
import type { Event } from '@/lib/models'
import { dateForDay, keyFor, minutes, todayInfo, duration, haptic } from '@/lib/utils'

import { BottomNav } from './BottomNav'
import { FocusMode } from './FocusMode'
import { Guide } from './Guide'
import { Review } from './Review'
import { TodayView } from './TodayView'
import { Topbar } from './Topbar'
import { WeekView } from './WeekView'
import { Toast } from './Toast'
import { Confetti } from './Confetti'
import FloatingActionButton from './FloatingActionButton'
import EventFormModal from './EventFormModal'

type View = 'today' | 'week' | 'review' | 'guide'

type StoredProgress = {
    checks: Record<string, boolean>
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

export function AppShell() {
    const [view, setView] = useState<View>('today')
    const [selectedDay, setSelectedDay] = useState<Day>(todayInfo().day)
    const [minimum, setMinimum] = useState(false)
    const [checks, setChecks] = useState<Record<string, boolean>>({})
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
    const [events, setEvents] = useState<Event[] | null>(null)
    const [formOpen, setFormOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<Event | null>(null)

    // Progress lives in the database. `loaded` gates persistence until the
    // initial fetch resolves; `saved` is the last snapshot written to the API.
    const loaded = useRef(false)
    const saved = useRef<StoredProgress>({ checks: {}, reviews: {}, energy: {}, theme: null })

    // Load events from the database. Until they arrive (or if the request
    // fails) the bundled schedule is used, so the view is never empty.
    const loadEvents = useCallback(async () => {
        try {
            const res = await fetch('/api/events', { cache: 'no-store' })
            if (!res.ok) return
            setEvents(await res.json())
        } catch {
            /* keep the bundled fallback schedule */
        }
    }, [])

    useEffect(() => {
        loadEvents()
    }, [loadEvents])

    // Day → blocks, built from the database; falls back to the bundled plan.
    const scheduleMap = useMemo<Record<Day, Block[]>>(() => {
        if (!events) return schedule
        const map = {} as Record<Day, Block[]>
        for (const day of days) {
            map[day] = events
                .filter((e) => e.day === day)
                .sort((a, b) => minutes(a.time) - minutes(b.time))
                .map((e) => ({
                    id: e._id,
                    time: e.time,
                    title: e.title,
                    category: e.category,
                    note: e.note,
                    essential: e.essential,
                }))
        }
        return map
    }, [events])

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
                    checks: data.checks ?? {},
                    reviews: data.reviews ?? {},
                    energy: data.energy ?? {},
                    theme: data.theme ?? null,
                }
                setChecks(next.checks)
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

            const checksDelta = changed(prev.checks, checks)
            if (Object.keys(checksDelta).length) body.checks = checksDelta
            const reviewsDelta = changed(prev.reviews, reviews)
            if (Object.keys(reviewsDelta).length) body.reviews = reviewsDelta
            const energyDelta = changed(prev.energy, energy)
            if (Object.keys(energyDelta).length) body.energy = energyDelta
            if (prev.theme !== theme) body.theme = theme

            if (Object.keys(body).length === 0) return
            saved.current = { checks, reviews, energy, theme }
            fetch('/api/progress', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).catch(() => {
                /* keep local state; the next change retries the save */
            })
        }, 600)
        return () => clearTimeout(id)
    }, [checks, reviews, energy, theme])

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
    const today = todayInfo()
    const activeDay = view === 'today' ? today.day : selectedDay
    const date = dateForDay(activeDay)
    const blocks = scheduleMap[activeDay]
    const shown = minimum ? blocks.filter((b) => b.essential) : blocks

    const isToday = activeDay === today.day
    const currentMinutes = safeNow.getHours() * 60 + safeNow.getMinutes()
    const currentIndex = mounted && isToday
        ? blocks.findIndex((b, i) => {
            const end = i < blocks.length - 1 ? minutes(blocks[i + 1].time) : minutes('05:30')
            let e = end
            if (e <= minutes(b.time)) e += 1440
            return currentMinutes >= minutes(b.time) && currentMinutes < e
        })
        : -1

    const completion = blocks.length
        ? blocks.filter((b) => checks[keyFor(date, activeDay, b.time)]).length / blocks.length
        : 0

    const essentialDone = blocks
        .filter((b) => b.essential)
        .every((b) => checks[keyFor(date, activeDay, b.time)])

    const nextBlock =
        currentIndex >= 0
            ? blocks[currentIndex + 1]
            : blocks.find((b) => minutes(b.time) > currentMinutes)

    const minsToNext = nextBlock ? Math.max(0, minutes(nextBlock.time) - currentMinutes) : 0

    const streak = useMemo(() => {
        let count = 0
        const d = new Date()
        for (let x = 0; x < 30; x++) {
            const day = days[(d.getDay() + 6) % 7] as Day
            const date = dateForDay(day, d)
            const arr = scheduleMap[day]
            const ok = arr
                .filter((b) => b.essential)
                .every((b) => checks[keyFor(date, day, b.time)])
            if (!ok) break
            count++
            d.setDate(d.getDate() - 1)
        }
        return count
    }, [checks, scheduleMap])

    const toggle = (i: number) => {
        const block = blocks[i]
        if (!block) return
        haptic(6)
        const key = keyFor(date, activeDay, block.time)
        const willBeDone = !checks[key]
        setChecks((v) => ({ ...v, [key]: willBeDone }))
        if (willBeDone && block.essential) {
            setToast({ message: 'Essential done · nice', tone: 'success' })
        }
    }

    const classHours = Math.round(
        blocks.reduce(
            (a, b, i) => a + (b.category === 'class' ? duration(b, blocks[i + 1]) : 0),
            0
        ) / 60 * 10
    ) / 10

    const studyHours = Math.round(
        blocks.reduce(
            (a, b, i) => a + (b.category === 'study' ? duration(b, blocks[i + 1]) : 0),
            0
        ) / 60 * 10
    ) / 10

    const focusBlock = blocks[currentIndex >= 0 ? currentIndex : 0]

    const handleLockIn = () => {
        const next = !lockIn
        haptic(10)
        setLockIn(next)
        setTimerRunning(next)
    }

    const openNewEvent = () => {
        haptic(6)
        setEditTarget(null)
        setFormOpen(true)
    }

    const openEditEvent = (block: Block) => {
        if (!block.id) return
        haptic(6)
        setEditTarget(events?.find((e) => e._id === block.id) ?? null)
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
            />

            {lockIn && (
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
                {view === 'today' && (
                    <TodayView
                        date={date}
                        activeDay={activeDay}
                        blocks={blocks}
                        shown={shown}
                        checks={checks}
                        completion={completion}
                        streak={streak}
                        currentIndex={currentIndex}
                        nextBlock={nextBlock}
                        minsToNext={minsToNext}
                        minimum={minimum}
                        setMinimum={setMinimum}
                        onToggle={toggle}
                        onEdit={openEditEvent}
                        mounted={mounted}
                    />
                )}

                {view === 'week' && (
                    <WeekView
                        date={date}
                        activeDay={activeDay}
                        blocks={blocks}
                        shown={shown}
                        checks={checks}
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
                )}

                {view === 'review' && (
                    <Review
                        reviews={reviews}
                        setReviews={setReviews}
                        onSaved={() => setToast({ message: 'Saved to your account', tone: 'success' })}
                    />
                )}
                {view === 'guide' && <Guide />}
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
                    loadEvents()
                }}
                event={editTarget}
                defaultDay={activeDay}
            />

            <BottomNav view={view} setView={setView} />
        </div>
    )
}