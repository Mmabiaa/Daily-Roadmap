'use client'

import { Clock3, Flame } from 'lucide-react'
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
    /** false during SSR + first client render — hides time-sensitive text */
    mounted?: boolean
}

export function TodayView({
    date, activeDay, blocks, shown, checks, completion, streak,
    currentIndex, nextBlock, minsToNext, minimum, setMinimum, onToggle,
    mounted = true,
}: Props) {
    const doneCount = blocks.filter((_, i) => checks[keyFor(date, activeDay, i)]).length

    return (
        <main className="content">
            <section className="today-intro">
                <div>
                    <p className="section-kicker">Your plan for today</p>
                    <h2>One block at a time.</h2>
                    <p>
                        {doneCount} of {blocks.length} complete · {streak} day minimum streak
                    </p>
                </div>
                <Ring value={completion} />
            </section>

            {/* Only render the time-sensitive banner after hydration to avoid mismatch */}
            {mounted && currentIndex >= 0 && (
                <div className="next-banner" suppressHydrationWarning>
                    <div className="live-dot" />
                    <div>
                        <strong>Now · {blocks[currentIndex].title}</strong>
                        <span>
                            {nextBlock
                                ? `${minsToNext} min until ${nextBlock.title}`
                                : 'You are at the end of today'}
                        </span>
                    </div>
                    <Clock3 />
                </div>
            )}

            {streak >= 3 && (
                <div className="streak-banner" aria-label="Streak">
                    <Flame aria-hidden="true" />
                    <span>
                        <strong>{streak} days</strong> of minimum kept — keep the thread
                    </span>
                </div>
            )}

            <div className="today-controls">
                <span>{minimum ? 'Minimum day' : 'Full day'}</span>
                <button
                    className={`switch ${minimum ? 'on' : ''}`}
                    role="switch"
                    aria-checked={minimum}
                    aria-label="Show minimum day"
                    onClick={() => setMinimum(!minimum)}
                >
                    <span />
                </button>
            </div>

            {shown.length === 0 ? (
                <div className="empty-state">
                    <p>No blocks to show.</p>
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
                                done={!!checks[keyFor(date, activeDay, i)]}
                                onToggle={() => onToggle(i)}
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