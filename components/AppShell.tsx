'use client'

import { useEffect, useMemo, useState } from 'react'
import { Block, Day, days, schedule } from '@/lib/schedule'
import { dateForDay, keyFor, minutes, todayInfo, duration } from '@/lib/utils'

import { BottomNav } from './BottomNav'
import { FocusMode } from './FocusMode'
import { Guide } from './Guide'
import { Review } from './Review'
import { TodayView } from './TodayView'
import { Topbar } from './Topbar'
import { WeekView } from './WeekView'

type View = 'today' | 'week' | 'review' | 'guide'

export function AppShell() {
    const [view, setView] = useState<View>('today')
    const [selectedDay, setSelectedDay] = useState<Day>(todayInfo().day)
    const [minimum, setMinimum] = useState(false)
    const [checks, setChecks] = useState<Record<string, boolean>>({})
    const [reviews, setReviews] = useState<Record<string, string[]>>({})
    const [energy, setEnergy] = useState<Record<string, 'low' | 'okay' | 'high'>>({})
    const [now, setNow] = useState(new Date())
    const [mounted, setMounted] = useState(false)
    const [theme, setTheme] = useState<'light' | 'dark'>('light')
    const [lockIn, setLockIn] = useState(false)
    const [timer, setTimer] = useState(50 * 60)
    const [timerRunning, setTimerRunning] = useState(false)

    // Hydrate from localStorage + tick `now` every 30s
    useEffect(() => {
        setMounted(true)
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

    // Register service worker
    useEffect(() => {
        if (mounted) {
            navigator.serviceWorker?.register('/sw.js').catch(() => { })
        }
    }, [mounted])

    // ─── Derived values ───
    const today = todayInfo()
    const activeDay = view === 'today' ? today.day : selectedDay
    const date = dateForDay(activeDay)
    const blocks = schedule[activeDay]
    const shown = minimum ? blocks.filter((b) => b.essential) : blocks

    const isToday = activeDay === today.day
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const currentIndex = isToday
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

    const toggle = (i: number) =>
        setChecks((v) => ({
            ...v,
            [keyFor(date, activeDay, i)]: !v[keyFor(date, activeDay, i)],
        }))

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

    const handleLockIn = () =>
        setLockIn((value) => {
            const next = !value
            setTimerRunning(next)
            return next
        })

    const subtitle =
        view === 'today'
            ? new Intl.DateTimeFormat('en', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            }).format(now)
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
                onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            />

            {lockIn && (
                <FocusMode
                    block={focusBlock}
                    timer={timer}
                    running={timerRunning}
                    onToggle={() => setTimerRunning((value) => !value)}
                    onClose={handleLockIn}
                />
            )}

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
                    setSelectedDay={setSelectedDay}
                    classHours={classHours}
                    studyHours={studyHours}
                    essentialDone={essentialDone}
                    minimum={minimum}
                    setMinimum={setMinimum}
                    onToggle={toggle}
                />
            )}

            {view === 'review' && <Review reviews={reviews} setReviews={setReviews} />}
            {view === 'guide' && <Guide />}

            <BottomNav view={view} setView={setView} />
        </div>
    )
}