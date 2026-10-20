'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { phoneRules, studyRules } from '@/lib/schedule'
import { haptic } from '@/lib/utils'

export function Guide() {
    const [signingOut, setSigningOut] = useState(false)

    const handleSignOut = async () => {
        if (signingOut) return
        haptic(8)
        setSigningOut(true)
        try {
            await fetch('/api/auth/signout', { method: 'POST' })
        } finally {
            window.location.replace('/signin')
        }
    }

    return (
        <main className="content guide-page">
            <section className="guide-intro">
                <p className="section-kicker">A softer system</p>
                <h2>Protect your attention.</h2>
                <p>
                    These are guardrails, not rules to be perfect at. Return to them when the day
                    gets noisy.
                </p>
            </section>

            <section className="guide-card">
                <h3>Phone rules</h3>
                {phoneRules.map((x, i) => (
                    <p key={x}>
                        <b>{String(i + 1).padStart(2, '0')}</b>
                        <span>{x}</span>
                    </p>
                ))}
            </section>

            <section className="guide-card">
                <h3>Study block format</h3>
                {studyRules.map((x, i) => (
                    <p key={x}>
                        <b>{String(i + 1).padStart(2, '0')}</b>
                        <span>{x}</span>
                    </p>
                ))}
            </section>

            <section className="guide-card minimum-card">
                <h3>Minimum day</h3>
                <p>
                    <span>
                        Wake at your usual time · the fixed things you cannot move · one study block ·
                        one small step on a goal of your own · lights out on time.
                    </span>
                </p>
                <small>Everything else is a bonus. No catching up tomorrow.</small>

                <button
                    type="button"
                    className="guide-signout"
                    onClick={handleSignOut}
                    disabled={signingOut}
                >
                    <LogOut aria-hidden="true" />
                    {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
            </section>
        </main>
    )
}
