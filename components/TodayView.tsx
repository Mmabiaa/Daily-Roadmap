'use client'

import { Clock3 } from 'lucide-react'
import { Block, Category, Day, days, schedule } from '@/lib/schedule'
import { keyFor, minutes } from '@/lib/utils'
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
}

export function TodayView({
    date, activeDay, blocks, shown, checks, completion, streak,
    currentIndex, nextBlock, minsToNext, minimum, setMinimum, onToggle,
}: Props) {
    return (
        <main className="content">
            <section className="today-intro">
                <div>
                    <p className="section-kicker">Your plan for today</p>
                    <h2>One block at a time.</h2>
                    <p>
                        {blocks.filter((_, i) => checks[keyFor(date, activeDay, i)]).length} of{' '}
                        {blocks.length} blocks complete · {streak} day minimum streak
                    </p>
                </div>
                <Ring value={completion} />
            </section>

            {currentIndex >= 0 && (
                <div className="next-banner">
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
        </main>
    )
}