'use client'

import { useEffect, useMemo, useState } from 'react'
import { Block, Day, days, schedule } from '@/lib/schedule'
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

type View = 'today' | 'week' | 'review' | 'guide'

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

    // Hydrate from localStorage + start clock AFTER mount (avoids SSR mismatch)
    useEffect(() => {
        setMounted(true)
        setNow(new Date())
        try {
            setChecks(JSON.parse(localStorage.getItem('fyr-checks') || '{}'))
            setReviews(JSON.parse(localStorage.getItem('fyr-reviews') || '{}'))
            setEnergy(JSON.parse(localStorage.getItem('fyr-energy') || '{}'))
            const savedTheme = localStorage.getItem('fyr-theme') as 'light' | 'dark' | null
            setTheme(
                savedTheme ||
                (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            )
        } catch { }

        const id = setInterval(() => setNow(new Date()), 30000)
        return () => clearInterval(id)
    }, [])

    // Apply theme
    useEffect(() => {
        if (!mounted) return
        document.documentElement.classList.toggle('dark', theme === 'dark')
        localStorage.setItem('fyr-theme', theme)
    }, [theme, mounted])

    // Persist
    useEffect(() => {
        if (mounted) localStorage.setItem('fyr-checks', JSON.stringify(checks))
    }, [checks, mounted])

    useEffect(() => {
        if (mounted) localStorage.setItem('fyr-reviews', JSON.stringify(reviews))
    }, [reviews, mounted])

    useEffect(() => {
        if (mounted) localStorage.setItem('fyr-energy', JSON.stringify(energy))
    }, [energy, mounted])

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

    // Register service worker (production only)
    useEffect(() => {
        if (mounted && process.env.NODE_ENV === 'production') {
            navigator.serviceWorker?.register('/sw.js').catch(() => { })
        }
    }, [mounted])

    // ─── Derived values ───
    // Use a "safe now" that's only the real clock once mounted.
    // Before mount: use midnight so server + first client render agree.
    const safeNow = now ?? new Date(2000, 0, 1, 0, 0, 0)
    const today = todayInfo()
    const activeDay = view === 'today' ? today.day : selectedDay
    const date = dateForDay(activeDay)
    const blocks = schedule[activeDay]
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
        ? blocks.filter((_, i) => checks[keyFor(date, activeDay, i)]).length / blocks.length
        : 0

    const essentialDone = blocks
        .filter((b) => b.essential)
        .every((b) => checks[keyFor(date, activeDay, blocks.indexOf(b))])

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
            const arr = schedule[day]
            const ok = arr
                .filter((b) => b.essential)
                .every((b) => checks[keyFor(date, day, arr.indexOf(b))])
            if (!ok) break
            count++
            d.setDate(d.getDate() - 1)
        }
        return count
    }, [checks])

    const toggle = (i: number) => {
        haptic(6)
        const key = keyFor(date, activeDay, i)
        const willBeDone = !checks[key]
        setChecks((v) => ({ ...v, [key]: willBeDone }))
        if (willBeDone) {
            const block = blocks[i]
            if (block?.essential) {
                setToast({ message: 'Essential done · nice', tone: 'success' })
            }
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
                    />
                )}

                {view === 'review' && (
                    <Review
                        reviews={reviews}
                        setReviews={setReviews}
                        onSaved={() => setToast({ message: 'Saved privately', tone: 'success' })}
                    />
                )}
                {view === 'guide' && <Guide />}
            </div>

            {toast && <Toast message={toast.message} tone={toast.tone} />}
            {celebrate && <Confetti />}

            <BottomNav view={view} setView={setView} />
        </div>
    )
}