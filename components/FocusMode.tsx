'use client'

import { Pause, Play, RotateCcw, Timer, Unlock } from 'lucide-react'
import { Block, categoryMeta } from '@/lib/schedule'
import { formatTime, haptic } from '@/lib/utils'

type Props = {
    block: Block
    timer: number
    running: boolean
    onToggle: () => void
    onClose: () => void
    onReset?: () => void
}

export function FocusMode({ block, timer, running, onToggle, onClose, onReset }: Props) {
    const mins = Math.floor(timer / 60)
    const secs = timer % 60
    const progress = 1 - timer / (50 * 60)

    return (
        <main className="focus-page" aria-label="Focus timer">
            <div className="focus-ring" aria-hidden="true">
                <svg viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="92" fill="none" stroke="var(--line)" strokeWidth="3" />
                    <circle
                        cx="100"
                        cy="100"
                        r="92"
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 92}
                        strokeDashoffset={2 * Math.PI * 92 * (1 - progress)}
                        transform="rotate(-90 100 100)"
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                </svg>
            </div>

            <div className={`focus-category category-${block.category}`}>
                <Timer aria-hidden="true" />
                <span>Focus mode</span>
            </div>

            <p className="section-kicker">
                {formatTime(block.time)} · {categoryMeta[block.category].label}
            </p>
            <h2>{block.title}</h2>
            {block.note && <p className="focus-note">{block.note}</p>}

            <div className="focus-timer" aria-live="polite">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <p className="focus-status">{running ? 'Timer running' : 'Timer paused'}</p>

            <div className="focus-actions">
                <button
                    className="focus-primary"
                    onClick={() => { haptic(6); onToggle() }}
                >
                    {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                    {running ? 'Pause' : 'Start'} timer
                </button>
                {onReset && (
                    <button
                        className="focus-secondary"
                        onClick={() => { haptic(5); onReset() }}
                    >
                        <RotateCcw aria-hidden="true" />
                        Reset to 50 min
                    </button>
                )}
                <button
                    className="focus-secondary"
                    onClick={() => { haptic(8); onClose() }}
                >
                    <Unlock aria-hidden="true" />
                    Exit focus mode
                </button>
            </div>
        </main>
    )
}