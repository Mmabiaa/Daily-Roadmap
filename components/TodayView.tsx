'use client'

import { AlertTriangle, Flame, RotateCcw } from 'lucide-react'
import type { BlockView, DayBlock } from '@/lib/resolver'
import { BlockRow } from './BlockRow'
import { Ring } from './Ring'

type EnergyLevel = 'low' | 'okay' | 'high'

type Props = {
    blocks: BlockView[]
    shown: BlockView[]
    completion: number
    streak: number
    /** How many times the account came back after a missed essential day. */
    comebacks: number
    /** The block happening now, the next to start, and minutes until now ends. */
    current: DayBlock | null
    next: DayBlock | null
    minutesLeft: number | null
    minimum: boolean
    setMinimum: (v: boolean) => void
    onToggle: (i: number) => void
    onEdit: (block: BlockView) => void
    /** Today's energy check-in, if it has been answered. */
    energyToday: EnergyLevel | null
    onEnergy: (level: EnergyLevel) => void
    /** Consecutive low days, ending today — two or more asks for a gentle day. */
    lowRun: number
    /** Hours of classes and study across the whole week, for the "too full" note. */
    weekLoad: number
    /** false during SSR + first client render — hides time-sensitive text */
    mounted?: boolean
}

const LEVELS: { id: EnergyLevel; label: string }[] = [
    { id: 'low', label: 'Low' },
    { id: 'okay', label: 'Okay' },
    { id: 'high', label: 'High' },
]

/** Above this many hours of fixed work and study, the week is worth a warning. */
const HEAVY_WEEK_HOURS = 40

export function TodayView({
    blocks, shown, completion, streak, comebacks,
    current, next, minutesLeft, minimum, setMinimum, onToggle, onEdit,
    energyToday, onEnergy, lowRun, weekLoad,
    mounted = true,
}: Props) {
    const doneCount = blocks.filter((b) => b.done).length
    const remaining = blocks.length - doneCount
    const allDone = blocks.length > 0 && remaining === 0
    const heavyWeek = weekLoad > HEAVY_WEEK_HOURS

    return (
        <main className="content">
            {/* One shared card: background image → progress ring → live "Now" strip */}
            <section className="today-hero" aria-label="Today's progress">
                <div className="today-hero-head">
                    <div className="today-hero-copy">
                        <h2>{allDone ? 'Day complete.' : 'One block at a time.'}</h2>
                        <p className="today-progress">
                            {allDone
                                ? `All ${blocks.length} blocks checked off`
                                : `${doneCount} of ${blocks.length} done · ${remaining} to go`}
                        </p>
                    </div>
                    <div className="today-ring">
                        <Ring value={completion} />
                    </div>
                </div>

                {/* Only render the time-sensitive strip after hydration to avoid mismatch */}
                {mounted && current && (
                    <div className="now-strip" suppressHydrationWarning>
                        <div className="live-dot" aria-hidden="true" />
                        <div className="now-strip-body">
                            <span className="now-strip-label">Happening now</span>
                            <strong className="now-strip-title">{current.title}</strong>
                            <span className="now-strip-next">
                                {next
                                    ? `Next: ${next.title}`
                                    : 'This is the last block of the day'}
                            </span>
                        </div>
                        {minutesLeft !== null && minutesLeft > 0 && (
                            <div className="now-strip-time">
                                <strong>{minutesLeft}</strong>
                                <span>min left</span>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {streak >= 3 && (
                <div className="streak-banner" aria-label="Streak">
                    <Flame aria-hidden="true" />
                    <span>
                        <strong>{streak} days</strong> of minimum kept — keep the thread
                    </span>
                </div>
            )}

            {comebacks > 0 && (
                <div className="comeback-card" aria-label="Times you came back">
                    <RotateCcw aria-hidden="true" />
                    <div>
                        <strong>You came back {comebacks} {comebacks === 1 ? 'time' : 'times'}.</strong>
                        <span>That is the number that matters most. Missing a day never ends it.</span>
                    </div>
                </div>
            )}

            <section className="energy-card" aria-label="Energy check-in">
                <div className="energy-options" role="group" aria-label="Today's energy">
                    {LEVELS.map((level) => (
                        <button
                            key={level.id}
                            type="button"
                            className={energyToday === level.id ? 'selected' : ''}
                            aria-pressed={energyToday === level.id}
                            onClick={() => onEnergy(level.id)}
                        >
                            {level.label}
                        </button>
                    ))}
                </div>
            </section>

            {lowRun >= 2 && (
                <p className="wellbeing-note gentle">
                    <span>
                        Two low days in a row. Be gentle today — your Minimum day is already enough,
                        and rest is part of the plan.
                    </span>
                </p>
            )}

            {heavyWeek && (
                <p className="wellbeing-note warn">
                    <AlertTriangle aria-hidden="true" />
                    <span>
                        Your week is full — about {Math.round(weekLoad)}h of classes and study. Trim
                        something small, or lean on Minimum days.
                    </span>
                </p>
            )}

            <div className="mode-bar">
                <div className="mode-toggle" role="group" aria-label="Choose how much of the day to show">
                    <button
                        type="button"
                        aria-pressed={!minimum}
                        onClick={() => setMinimum(false)}
                    >
                        Full day
                    </button>
                    <button
                        type="button"
                        aria-pressed={minimum}
                        onClick={() => setMinimum(true)}
                    >
                        Minimum day
                    </button>
                </div>
                <span className="mode-count">
                    {shown.length} of {blocks.length} blocks
                </span>
            </div>

            {shown.length === 0 ? (
                <div className="empty-state">
                    <p>No blocks to show.</p>
                    {minimum ? (
                        <>
                            <p className="empty-hint">No essential blocks are scheduled for this day.</p>
                            <button type="button" className="empty-action" onClick={() => setMinimum(false)}>
                                Show full day
                            </button>
                        </>
                    ) : (
                        <p className="empty-hint">Nothing is scheduled for this day yet.</p>
                    )}
                </div>
            ) : (
                <div className="timeline">
                    {shown.map((block) => {
                        const i = blocks.indexOf(block)
                        return (
                            <BlockRow
                                key={block.eventId}
                                block={block}
                                done={block.done}
                                onToggle={() => onToggle(i)}
                                onEdit={() => onEdit(block)}
                                isNow={current?.eventId === block.eventId}
                                dim={minimum && !block.essential}
                            />
                        )
                    })}
                </div>
            )}
        </main>
    )
}
