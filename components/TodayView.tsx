'use client'

import { Flame } from 'lucide-react'
import { Block, Day } from '@/lib/schedule'
import { keyFor } from '@/lib/utils'
import { BlockRow } from './BlockRow'
import { Ring } from './Ring'

type Checks = Record<string, boolean>

type Props = {
    date: string
    activeDay: Day
    blocks: Block[]
    shown: Block[]
    checks: Checks
    completion: number
    streak: number
    currentIndex: number
    nextBlock?: Block
    minsToNext: number
    minimum: boolean
    setMinimum: (v: boolean) => void
    onToggle: (i: number) => void
    onEdit: (block: Block) => void
    /** false during SSR + first client render — hides time-sensitive text */
    mounted?: boolean
}

/**
 * "2026-10-19" -> "Monday, October 19".
 * Parsed and formatted in local time with a fixed locale, so server and
 * client always produce the same string (no hydration mismatch).
 */
function formatDate(date: string) {
    const d = new Date(`${date}T00:00:00`)
    if (Number.isNaN(d.getTime())) return 'Today'
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function TodayView({
    date, activeDay, blocks, shown, checks, completion, streak,
    currentIndex, nextBlock, minsToNext, minimum, setMinimum, onToggle, onEdit,
    mounted = true,
}: Props) {
    const doneCount = blocks.filter((b) => checks[keyFor(date, activeDay, b.time)]).length
    const remaining = blocks.length - doneCount
    const allDone = blocks.length > 0 && remaining === 0
    const current = currentIndex >= 0 ? blocks[currentIndex] : undefined

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
                                {nextBlock
                                    ? `Next: ${nextBlock.title}`
                                    : 'This is the last block of the day'}
                            </span>
                        </div>
                        {nextBlock && (
                            <div className="now-strip-time">
                                <strong>{minsToNext}</strong>
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
                                key={block.time}
                                block={block}
                                index={i}
                                next={blocks[i + 1]}
                                done={!!checks[keyFor(date, activeDay, block.time)]}
                                onToggle={() => onToggle(i)}
                                onEdit={block.id ? () => onEdit(block) : undefined}
                                isNow={i === currentIndex}
                                dim={minimum && !block.essential}
                            />
                        )
                    })}
                </div>
            )}
        </main>
    )
}