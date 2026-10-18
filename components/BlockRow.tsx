'use client'

import { Check } from 'lucide-react'
import type { Block } from '@/lib/schedule'
import { duration, formatTime } from '@/lib/utils'

type Props = {
    block: Block
    index: number
    next?: Block
    done: boolean
    onToggle: () => void
    isNow: boolean
    dim?: boolean
}

export function BlockRow({ block, index, next, done, onToggle, isNow, dim }: Props) {
    return (
        <div
            ref={
                isNow
                    ? (el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                    : undefined
            }
            className={`timeline-row ${isNow ? 'is-now' : ''} ${dim ? 'opacity-65' : ''}`}
        >
            <div className="time-col">
                <span>{formatTime(block.time)}</span>
                <small>{duration(block, next)}m</small>
            </div>
            <div className="timeline-line">
                <button
                    aria-label={`${done ? 'Uncomplete' : 'Complete'} ${block.title}`}
                    onClick={onToggle}
                    className={`check-button ${done ? 'checked' : ''}`}
                >
                    {done && <Check aria-hidden="true" />}
                </button>
            </div>
            <div className={`block-card category-${block.category}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className={`block-title ${done ? 'line-through opacity-55' : ''}`}>
                            {block.title}
                        </p>
                        {block.note && <p className="block-note">{block.note}</p>}
                    </div>
                    {isNow && <span className="now-pill">Now</span>}
                </div>
            </div>
        </div>
    )
}