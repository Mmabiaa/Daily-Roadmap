'use client'

import { Pause, Play, RotateCcw, Timer, X } from 'lucide-react'
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

const TOTAL = 50 * 60

export function FocusMode({ block, timer, running, onToggle, onClose, onReset }: Props) {
    const mins = Math.floor(timer / 60)
    const secs = timer % 60
    const elapsed = Math.max(0, Math.min(1, 1 - timer / TOTAL))

    return (
        <main className="focus-page" aria-label="Focus timer">
            <header className="focus-head">
                <div className={`focus-tag category-${block.category}`}>
                    <Timer aria-hidden="true" />
                    <span>{categoryMeta[block.category].label}</span>
                </div>
                <button
                    className="icon-button focus-close"
                    aria-label="Exit focus mode"
                    onClick={() => { haptic(8); onClose() }}
                >
                    <X aria-hidden="true" />
                </button>
            </header>

            <section className={`focus-body category-${block.category}`}>
                <p className="section-kicker">{formatTime(block.time)}</p>
                <h1 className="focus-title">{block.title}</h1>
                {block.note && <p className="focus-note">{block.note}</p>}

                <div className="focus-stack">
                    <div className="focus-clock" aria-live="polite">
                        <span className="focus-time">
                            <span className="focus-time-mins">
                                {String(mins).padStart(2, '0')}
                            </span>
                            <span className="focus-time-sep" aria-hidden="true">:</span>
                            <span className="focus-time-secs">
                                {String(secs).padStart(2, '0')}
                            </span>
                        </span>
                        <span className="focus-state" data-running={running}>
                            <span className="focus-state-dot" aria-hidden="true" />
                            {running ? 'Running' : 'Paused'}
                        </span>
                    </div>

                    <div className="focus-progress" aria-hidden="true">
                        <span style={{ transform: `scaleX(${elapsed})` }} />
                    </div>

                    <div className="focus-actions">
                        <button
                            className="focus-primary"
                            data-running={running}
                            onClick={() => { haptic(6); onToggle() }}
                        >
                            {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                            {running ? 'Pause' : 'Start'}
                        </button>
                        {onReset && (
                            <button
                                className="focus-ghost"
                                onClick={() => { haptic(5); onReset() }}
                            >
                                <RotateCcw aria-hidden="true" />
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            </section>
        </main>
    )
}