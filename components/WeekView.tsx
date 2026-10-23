'use client'

import { Day, days } from '@/lib/schedule'
import type { BlockView } from '@/lib/resolver'
import { BlockRow } from './BlockRow'

type Props = {
    blocks: BlockView[]
    shown: BlockView[]
    selectedDay: Day
    setSelectedDay: (d: Day) => void
    headline: string
    classHours: number
    studyHours: number
    essentialDone: boolean
    minimum: boolean
    setMinimum: (v: boolean) => void
    onToggle: (i: number) => void
    onEdit: (block: BlockView) => void
}

export function WeekView({
    blocks, shown,
    selectedDay, setSelectedDay, headline, classHours, studyHours, essentialDone,
    minimum, setMinimum, onToggle, onEdit,
}: Props) {
    return (
        <main className="content">
            <div className="day-tabs" role="tablist" aria-label="Days of the week">
                {days.map((d) => (
                    <button
                        key={d}
                        role="tab"
                        aria-selected={d === selectedDay}
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
                    <strong className={essentialDone ? 'is-done' : ''}>
                        {essentialDone ? 'Done' : 'Open'}
                    </strong>
                </div>
            </div>

            <section className="week-heading">
                <div>
                    <p className="section-kicker">{selectedDay}</p>
                    <h2 key={selectedDay} className="title-anim">{headline}</h2>
                </div>
                <button
                    className={`switch ${minimum ? 'on' : ''}`}
                    role="switch"
                    aria-checked={minimum}
                    aria-label="Show minimum day"
                    onClick={() => setMinimum(!minimum)}
                >
                    <span />
                </button>
            </section>

            {shown.length === 0 ? (
                <div className="empty-state">
                    <p>No blocks to show.</p>
                    <p className="empty-hint">
                        Nothing is scheduled for {selectedDay} yet. Tap the + button to add one.
                    </p>
                </div>
            ) : (
                <div className="timeline" key={selectedDay}>
                    {shown.map((block) => {
                        const i = blocks.indexOf(block)
                        return (
                            <BlockRow
                                key={block.eventId}
                                block={block}
                                done={block.done}
                                onToggle={() => onToggle(i)}
                                onEdit={() => onEdit(block)}
                                isNow={false}
                            />
                        )
                    })}
                </div>
            )}
        </main>
    )
}
