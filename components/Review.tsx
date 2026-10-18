'use client'

import { Check, Sun } from 'lucide-react'

type Reviews = Record<string, string[]>
type Props = {
    reviews: Reviews
    setReviews: React.Dispatch<React.SetStateAction<Reviews>>
}

const prompts = [
    'Where was I honest with myself?',
    'Who did I check on?',
    'What do I adjust next week?',
]

export function Review({ reviews, setReviews }: Props) {
    const date = new Date().toISOString().slice(0, 10)
    const values = reviews[date] || ['', '', '']

    return (
        <main className="content review-page">
            <section className="review-intro">
                <div className="review-mark">
                    <Sun />
                </div>
                <p className="section-kicker">
                    Sunday,{' '}
                    {new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric' }).format(new Date())}
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
                            onChange={(e) =>
                                setReviews((v) => ({
                                    ...v,
                                    [date]: values.map((x, j) => (j === i ? e.target.value : x)),
                                }))
                            }
                            placeholder="Write a few words…"
                        />
                    </label>
                ))}
            </div>

            <p className="saved-note">
                <Check /> Saved privately on this device
            </p>
        </main>
    )
}