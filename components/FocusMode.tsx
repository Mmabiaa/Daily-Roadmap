'use client'

import { Pause, Play, Timer, Unlock } from 'lucide-react'
import { Block, categoryMeta } from '@/lib/schedule'
import { formatTime } from '@/lib/utils'

type Props = {
    block: Block
    timer: number
    running: boolean
    onToggle: () => void
    onClose: () => void
}

export function FocusMode({ block, timer, running, onToggle, onClose }: Props) {
    const mins = Math.floor(timer / 60)
    const secs = timer % 60

    return (
        <main className="focus-page" aria-label="Focus timer">
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
                <button className="focus-primary" onClick={onToggle}>
                    {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                    {running ? 'Pause' : 'Start'} timer
                </button>
                <button className="focus-secondary" onClick={onClose}>
                    <Unlock aria-hidden="true" />
                    Exit focus mode
                </button>
            </div>
        </main>
    )
}