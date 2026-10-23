'use client'

import { Check, ThumbsUp, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { categoryMeta, type Category } from '@/lib/schedule'

type Reviews = Record<string, string[]>

/** One block's record, as `GET /api/insights` counts it. */
type Insight = {
    eventId: string
    title: string
    category: Category
    occurred: number
    done: number
    rate: number
}

type Insights = {
    streak: number
    comebacks: number
    strengths: Insight[]
    slips: Insight[]
    tracked: number
}

type Props = {
    reviews: Reviews
    setReviews: React.Dispatch<React.SetStateAction<Reviews>>
    onSaved?: () => void
}

const prompts = [
    'Where was I honest with myself?',
    'Who did I check on?',
    'What do I adjust next week?',
]

export function Review({ reviews, setReviews, onSaved }: Props) {
    const date = new Date().toISOString().slice(0, 10)
    const values = reviews[date] || ['', '', '']
    const [dirty, setDirty] = useState(false)
    // What the account's own history says. Loaded once, and only read — a
    // failure here leaves the prompts below working as before.
    const [insights, setInsights] = useState<Insights | null>(null)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/insights', { cache: 'no-store' })
                if (!res.ok) return
                const data: Insights = await res.json()
                if (!cancelled) setInsights(data)
            } catch {
                /* offline — the prompts still work */
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!dirty) return
        const id = setTimeout(() => {
            onSaved?.()
            setDirty(false)
        }, 900)
        return () => clearTimeout(id)
    }, [dirty, onSaved])

    const hasAny = values.some((v) => v.trim().length > 0)

    /** One block, with how often it was kept as a bar in its own colour. */
    const rows = (items: Insight[]) => (
        <div className="insight-list">
            {items.map((item) => (
                <div className="insight-row" key={item.eventId}>
                    <div className="insight-head">
                        <span className="insight-title">{item.title}</span>
                        <span className="insight-count">
                            {item.done}/{item.occurred}
                        </span>
                    </div>
                    <div
                        className="insight-bar"
                        style={
                            { '--bar': `var(${categoryMeta[item.category].color})` } as React.CSSProperties
                        }
                    >
                        <span style={{ width: `${Math.round(item.rate * 100)}%` }} />
                    </div>
                </div>
            ))}
        </div>
    )

    return (
        <main className="content review-page">
            <section className="review-intro">
                <p className="section-kicker">
                    {new Intl.DateTimeFormat('en', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                    }).format(new Date())}
                </p>
                <h2>Make space for the truth.</h2>
                <p>Three honest answers are enough. This is not a performance review.</p>
            </section>

            {insights && insights.tracked > 0 ? (
                <>
                    <section className="review-stats">
                        <div>
                            <span>Streak</span>
                            <strong>{insights.streak}</strong>
                        </div>
                        <div>
                            <span>Comebacks</span>
                            <strong>{insights.comebacks}</strong>
                        </div>
                    </section>

                    {insights.strengths.length > 0 && (
                        <section className="guide-card">
                            <h3>
                                <ThumbsUp /> What you keep
                            </h3>
                            {rows(insights.strengths)}
                        </section>
                    )}

                    {insights.slips.length > 0 && (
                        <section className="guide-card">
                            <h3>
                                <TriangleAlert /> What slips
                            </h3>
                            {rows(insights.slips)}
                        </section>
                    )}
                </>
            ) : insights ? (
                <p className="review-hint">
                    Tick a few blocks for a week and this page will show what you keep and what
                    slips.
                </p>
            ) : null}

            <div className="prompt-list">
                {prompts.map((p, i) => (
                    <label key={p}>
                        <span>{p}</span>
                        <textarea
                            value={values[i]}
                            onChange={(e) => {
                                setDirty(true)
                                setReviews((v) => ({
                                    ...v,
                                    [date]: values.map((x, j) => (j === i ? e.target.value : x)),
                                }))
                            }}
                            placeholder="Write a few words…"
                            rows={3}
                        />
                    </label>
                ))}
            </div>

            <p className={`saved-note ${hasAny ? 'is-active' : ''}`}>
                <Check aria-hidden="true" />
                {hasAny ? 'Saved to your account' : 'Your notes are saved to your account'}
            </p>
        </main>
    )
}
