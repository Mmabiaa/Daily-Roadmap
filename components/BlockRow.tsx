'use client'

import { useEffect, useRef } from 'react'
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

/** "side-project" -> "side project" (capitalised in CSS) */
const categoryLabel = (category: string) => category.replace(/-/g, ' ')

export function BlockRow({ block, next, done, onToggle, isNow, dim }: Props) {
    const rowRef = useRef<HTMLDivElement>(null)

    // Scroll to the current block only when it *becomes* current —
    // not on every re-render (e.g. when you tick a checkbox).
    useEffect(() => {
        if (!isNow) return
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        rowRef.current?.scrollIntoView({
            block: 'center',
            behavior: reduceMotion ? 'auto' : 'smooth',
        })
    }, [isNow])

    return (
        <div
            ref={rowRef}
            aria-current={isNow ? 'time' : undefined}
            className={`timeline-row ${isNow ? 'is-now' : ''} ${dim ? 'is-dim' : ''}`}
        >
            <div className="time-col">
                <span>{formatTime(block.time)}</span>
                <small>{duration(block, next)} min</small>
            </div>

            <div className="timeline-line">
                <button
                    type="button"
                    aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${block.title}`}
                    aria-pressed={done}
                    onClick={onToggle}
                    className={`check-button ${done ? 'checked' : ''}`}
                >
                    {done && <Check aria-hidden="true" />}
                </button>
            </div>

            <div className={`block-card category-${block.category} ${done ? 'is-done' : ''}`}>
                <div className="block-card-top">
                    <p className="block-title">{block.title}</p>
                    {isNow && <span className="now-pill">Now</span>}
                </div>
                {block.note && <p className="block-note">{block.note}</p>}
                <span className="block-meta">
                    <i aria-hidden="true" />
                    {categoryLabel(block.category)}
                </span>
            </div>
        </div>
    )
}