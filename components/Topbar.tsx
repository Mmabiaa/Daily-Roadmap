'use client'

import Image from 'next/image'
import { Lock, Moon, Sun, Unlock } from 'lucide-react'
import { haptic } from '@/lib/utils'

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

export function Topbar({
    view,
    subtitle,
    theme,
    lockIn,
    onToggleLockIn,
    onToggleTheme,
}: Props) {
    return (
        <header className="topbar">
            <div className="topbar-text">
                <Image
                    className="topbar-avatar"
                    src="https://i.pinimg.com/736x/0b/97/6f/0b976f0a7aa1aa43870e1812eee5a55d.jpg"
                    alt=""
                    width={40}
                    height={40}
                    priority
                    sizes="40px"
                />
                <div className="topbar-meta">
                    <h1 key={view} className="title-anim">
                        {titles[view]}
                    </h1>
                    <p className="subtitle">{subtitle}</p>
                </div>
            </div>
            <div className="header-actions">
                <button
                    className={`icon-button lock-in-button ${lockIn ? 'is-active' : ''}`}
                    aria-pressed={lockIn}
                    aria-label={lockIn ? 'Unlock focus mode' : 'Lock in to this plan'}
                    onClick={() => {
                        haptic(6)
                        onToggleLockIn()
                    }}
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