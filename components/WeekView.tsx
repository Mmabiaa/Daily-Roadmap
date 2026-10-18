'use client'

import { Block, Day, days, focus } from '@/lib/schedule'
import { keyFor } from '@/lib/utils'
import { BlockRow } from './BlockRow'

type Checks = Record<string, boolean>

type Props = {
    date: string
    activeDay: Day
    blocks: Block[]
    shown: Block[]
    checks: Checks
    selectedDay: Day
    setSelectedDay: (d: Day) => void
    classHours: number
    studyHours: number
    essentialDone: boolean
    minimum: boolean
    setMinimum: (v: boolean) => void
    onToggle: (i: number) => void
}

export function WeekView({
    date, activeDay, blocks, shown, checks,
    selectedDay, setSelectedDay, classHours, studyHours, essentialDone,
    minimum, setMinimum, onToggle,
}: Props) {
    return (
        <main className="content">
            <div className="day-tabs">
                {days.map((d) => (
                    <button
                        key={d}
                        onClick={() => setSelectedDay(d)}
                        className={d === selectedDay ? 'selected' : ''}
                    >
                        <span>{d.slice(0, 1)}</span>
                        <small>{d}</small>
                    </button>
                ))}
            </div>

            <div className="week-summary">
                <div>
                    <span>Class hours</span>
                    <strong>{classHours}h</strong>
                </div>
                <div>
                    <span>Study hours</span>
                    <strong>{studyHours}h</strong>
                </div>
                <div>
                    <span>Minimum day</span>
                    <strong>{essentialDone ? 'Done' : 'Open'}</strong>
                </div>
            </div>

            <section className="week-heading">
                <div>
                    <p className="section-kicker">{selectedDay}</p>
                    <h2>{focus[selectedDay]}</h2>
                </div>
                <button
                    className={`switch ${minimum ? 'on' : ''}`}
                    role="switch"
                    aria-checked={minimum}
                    onClick={() => setMinimum(!minimum)}
                >
                    <span />
                </button>
            </section>

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
                            isNow={false}
                        />
                    )
                })}
            </div>
        </main>
    )
}