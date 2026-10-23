'use client'

import { CalendarDays, CircleHelp, House, Settings as SettingsIcon, Users } from 'lucide-react'
import { haptic } from '@/lib/utils'

type View = 'today' | 'week' | 'review' | 'guide' | 'settings'

const items = [
    ['today', House, 'Today'],
    ['week', CalendarDays, 'Week'],
    ['review', Users, 'Review'],
    ['guide', CircleHelp, 'Guide'],
    ['settings', SettingsIcon, 'Settings'],
] as const

type Props = { view: View; setView: (v: View) => void }

export function BottomNav({ view, setView }: Props) {
    return (
        <nav className="bottom-nav" role="navigation" aria-label="Primary">
            {items.map(([id, Icon, label]) => (
                <button
                    key={id}
                    className={view === id ? 'active' : ''}
                    aria-current={view === id ? 'page' : undefined}
                    onClick={() => { haptic(4); setView(id) }}
                >
                    <span className="nav-icon-wrap">
                        <Icon aria-hidden="true" />
                        {view === id && <span className="nav-pip" aria-hidden="true" />}
                    </span>
                    <span>{label}</span>
                </button>
            ))}
        </nav>
    )
}
