'use client'

import { Flame } from 'lucide-react'
import type { BlockView, DayBlock } from '@/lib/resolver'
import { BlockRow } from './BlockRow'
import { Ring } from './Ring'

type Props = {
    blocks: BlockView[]
    shown: BlockView[]
    completion: number
    streak: number
    /** The block happening now, the next to start, and minutes until now ends. */
    current: DayBlock | null
    next: DayBlock | null
    minutesLeft: number | null
    minimum: boolean
    setMinimum: (v: boolean) => void
    onToggle: (i: number) => void
    onEdit: (block: BlockView) => void
    /** false during SSR + first client render — hides time-sensitive text */
    mounted?: boolean
}

export function TodayView({
    blocks, shown, completion, streak,
    current, next, minutesLeft, minimum, setMinimum, onToggle, onEdit,
    mounted = true,
}: Props) {
    const doneCount = blocks.filter((b) => b.done).length
    const remaining = blocks.length - doneCount
    const allDone = blocks.length > 0 && remaining === 0

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
