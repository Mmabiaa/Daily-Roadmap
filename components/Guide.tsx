'use client'

import { phoneRules, studyRules } from '@/lib/schedule'

export function Guide() {
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
                        {x}
                    </p>
                ))}
            </section>

            <section className="guide-card">
                <h3>Study block format</h3>
                {studyRules.map((x, i) => (
                    <p key={x}>
                        <b>{String(i + 1).padStart(2, '0')}</b>
                        {x}
                    </p>
                ))}
            </section>

            <section className="guide-card minimum-card">
                <h3>Minimum day</h3>
                <p>
                    Wake at 5:30 · attend classes · one study block · one commit · one Duolingo
                    lesson · lights out on time.
                </p>
                <small>Everything else is a bonus. No catching up tomorrow.</small>
            </section>
        </main>
    )
}