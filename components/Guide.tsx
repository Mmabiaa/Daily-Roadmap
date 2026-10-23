'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Rules } from '@/lib/models'
import { haptic } from '@/lib/utils'

type Props = {
    rules: Rules
    onRules: (rules: Rules) => void
}

const cleaned = (lines: string[]) => lines.map((line) => line.trim()).filter(Boolean)

/**
 * The account's own guardrails, plus what a Minimum day is.
 *
 * The two lists belong to the person, not the product, so they start from the
 * app's defaults and are then theirs to edit. Blank rows are allowed while
 * typing but never saved.
 */
export function Guide({ rules, onRules }: Props) {
    const [phone, setPhone] = useState<string[]>(rules.phone)
    const [study, setStudy] = useState<string[]>(rules.study)

    useEffect(() => {
        const next: Rules = { phone: cleaned(phone), study: cleaned(study) }
        if (JSON.stringify(next) === JSON.stringify(rules)) return

        const id = setTimeout(() => onRules(next), 700)
        return () => clearTimeout(id)
    }, [phone, study, rules, onRules])

    const card = (
        title: string,
        lines: string[],
        setLines: (lines: string[]) => void,
        placeholder: string
    ) => (
        <section className="guide-card">
            <h3>{title}</h3>
            {lines.map((line, i) => (
                <div className="guide-rule" key={i}>
                    <span className="guide-rule-index">{String(i + 1).padStart(2, '0')}</span>
                    <input
                        value={line}
                        placeholder={placeholder}
                        onChange={(e) =>
                            setLines(lines.map((x, j) => (j === i ? e.target.value : x)))
                        }
                    />
                    <button
                        type="button"
                        className="guide-rule-remove"
                        aria-label="Remove this rule"
                        onClick={() => {
                            haptic(5)
                            setLines(lines.filter((_, j) => j !== i))
                        }}
                    >
                        <X aria-hidden="true" />
                    </button>
                </div>
            ))}
            <button
                type="button"
                className="guide-add"
                onClick={() => {
                    haptic(5)
                    setLines([...lines, ''])
                }}
            >
                <Plus aria-hidden="true" />
                Add a rule
            </button>
        </section>
    )

    return (
        <main className="content guide-page">
            <section className="guide-intro">
                <p className="section-kicker">A softer system</p>
                <h2>Protect your attention.</h2>
                <p>
                    These are guardrails, not rules to be perfect at. They are yours — edit them to
                    fit your days, and return to them when the day gets noisy.
                </p>
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
            </section>

            {card('Phone rules', phone, setPhone, 'Keep the phone out of reach…')}
            {card('Study block format', study, setStudy, '50 minutes on, 10 off…')}
        </main>
    )
}
