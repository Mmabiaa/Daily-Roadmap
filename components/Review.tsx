'use client'

import { Check, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type Reviews = Record<string, string[]>
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

    useEffect(() => {
        if (!dirty) return
        const id = setTimeout(() => {
            onSaved?.()
            setDirty(false)
        }, 900)
        return () => clearTimeout(id)
    }, [dirty, onSaved])

    const hasAny = values.some((v) => v.trim().length > 0)

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
                {hasAny ? 'Saved privately on this device' : 'Your notes stay on this device'}
            </p>
        </main>
    )
}