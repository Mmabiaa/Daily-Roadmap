'use client'

import { useEffect, useState } from 'react'
import { Check, Pause, Play, Timer, X } from 'lucide-react'
import { categoryMeta } from '@/lib/schedule'
import type { DayBlock } from '@/lib/resolver'
import { formatTime, haptic } from '@/lib/utils'

type Props = {
    block: DayBlock
    timer: number
    running: boolean
    onToggle: () => void
    onClose: () => void
    onReset?: () => void
}

const TOTAL = 50 * 60

/* Progress ring geometry (SVG viewBox is 220 × 220) */
const RADIUS = 100
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function FocusMode({ block, timer, running, onToggle, onClose, onReset }: Props) {
    const mins = Math.floor(timer / 60)
    const secs = timer % 60
    const elapsed = Math.max(0, Math.min(1, 1 - timer / TOTAL))
    const complete = timer <= 0

    // "Finish at …" depends on the current time, so only render it on the client
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const finishAt = new Date(Date.now() + timer * 1000).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    })
    const caption = complete
        ? 'Session complete'
        : running
            ? mounted ? `Finish at ${finishAt}` : 'Running'
            : 'Paused'
    const stateLabel = complete ? 'complete' : running ? 'running' : 'paused'

    // Esc closes focus mode
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <main className={`focus-page category-${block.category}`} aria-label="Focus timer">
            <div className="focus-inner">
                <header className="focus-head">
                    <div className="focus-tag">
                        <i aria-hidden="true" />
                        <span>{categoryMeta[block.category].label}</span>
                    </div>
                    <button
                        type="button"
                        className="icon-button focus-close"
                        aria-label="Exit focus mode"
                        onClick={() => { haptic(8); onClose() }}
                    >
                        <X aria-hidden="true" />
                    </button>
                </header>

                <section className="focus-body">
                    <div className="focus-intro">
                        <p className="focus-when">{formatTime(block.start)}</p>
                        <h1 className="focus-title">{block.title}</h1>
                        {block.note && <p className="focus-note">{block.note}</p>}
                    </div>

                    <div className="focus-timer">
                        <div className="focus-ring">
                            <div className="focus-ring-disc" aria-hidden="true" />
                            <svg viewBox="0 0 220 220" aria-hidden="true">
                                <circle className="focus-ring-track" cx="110" cy="110" r={RADIUS} />
                                <circle
                                    className="focus-ring-bar"
                                    cx="110"
                                    cy="110"
                                    r={RADIUS}
                                    strokeDasharray={CIRCUMFERENCE}
                                    strokeDashoffset={CIRCUMFERENCE * (1 - elapsed)}
                                    style={{ opacity: elapsed === 0 ? 0 : 1 }}
                                />
                            </svg>

                            <div className="focus-clock">
                                <span className="focus-badge" aria-hidden="true">
                                    {complete ? <Check /> : <Timer />}
                                </span>
                                {/* role="timer" isn't announced every second; the live region below announces state changes */}
                                <span
                                    className="focus-time"
                                    role="timer"
                                    aria-label={`${mins} minutes ${secs} seconds remaining`}
                                >
                                    <span>{String(mins).padStart(2, '0')}</span>
                                    <span className="focus-time-sep" aria-hidden="true">:</span>
                                    <span>{String(secs).padStart(2, '0')}</span>
                                </span>
                                <span className="focus-caption" suppressHydrationWarning>{caption}</span>
                            </div>
                        </div>

                        <p className="focus-total">Total {Math.round(TOTAL / 60)} min</p>
                        <span className="focus-sr" aria-live="polite">{`Timer ${stateLabel}`}</span>
                    </div>
                </section>

                <div className="focus-actions" data-solo={!onReset}>
                    <button
                        type="button"
                        className="focus-primary"
                        data-running={running}
                        onClick={() => { haptic(6); onToggle() }}
                    >
                        {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                        {running ? 'Pause' : 'Start'}
                    </button>
                    {onReset && (
                        <button
                            type="button"
                            className="focus-ghost"
                            onClick={() => { haptic(5); onReset() }}
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>
        </main>
    )
}