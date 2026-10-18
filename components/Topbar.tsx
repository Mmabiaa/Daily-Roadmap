'use client'

import { Lock, Moon, Sun, Unlock } from 'lucide-react'

type View = 'today' | 'week' | 'review' | 'guide'

const titles: Record<View, string> = {
    today: 'Today',
    week: 'Your week',
    review: 'Weekly review',
    guide: 'Guide & rules',
}

type Props = {
    view: View
    subtitle: string
    theme: 'light' | 'dark'
    lockIn: boolean
    onToggleLockIn: () => void
    onToggleTheme: () => void
}

export function Topbar({ view, subtitle, theme, lockIn, onToggleLockIn, onToggleTheme }: Props) {
    return (
        <header className="topbar">
            <div>
                <p className="eyebrow">CE 400 · Group A</p>
                <h1>{titles[view]}</h1>
                <p className="subtitle">{subtitle}</p>
            </div>
            <div className="header-actions">
                <button
                    className={`icon-button lock-in-button ${lockIn ? 'is-active' : ''}`}
                    aria-pressed={lockIn}
                    aria-label={lockIn ? 'Unlock focus mode' : 'Lock in to this plan'}
                    onClick={onToggleLockIn}
                >
                    {lockIn ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
                </button>
                <button
                    className="icon-button"
                    aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    onClick={onToggleTheme}
                >
                    {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
                </button>
            </div>
        </header>
    )
}