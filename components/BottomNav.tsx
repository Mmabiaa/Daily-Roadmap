'use client'

import { CalendarDays, CircleHelp, House, Users } from 'lucide-react'

type View = 'today' | 'week' | 'review' | 'guide'

const items = [
    ['today', House, 'Today'],
    ['week', CalendarDays, 'Week'],
    ['review', Users, 'Review'],
    ['guide', CircleHelp, 'Guide'],
] as const

type Props = { view: View; setView: (v: View) => void }

export function BottomNav({ view, setView }: Props) {
    return (
        <nav className="bottom-nav">
            {items.map(([id, Icon, label]) => (
                <button
                    key={id}
                    className={view === id ? 'active' : ''}
                    onClick={() => setView(id)}
                >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                </button>
            ))}
        </nav>
    )
}