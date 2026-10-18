'use client'

import { useMemo } from 'react'

export function Confetti() {
    const pieces = useMemo(
        () =>
            Array.from({ length: 18 }).map((_, i) => ({
                id: i,
                left: Math.random() * 100,
                delay: Math.random() * 0.4,
                duration: 0.9 + Math.random() * 0.7,
                rotate: Math.random() * 360,
                color: ['var(--primary)', 'var(--project)', 'var(--study)', 'var(--eat)'][
                    Math.floor(Math.random() * 4)
                ],
            })),
        []
    )

    return (
        <div className="confetti" aria-hidden="true">
            {pieces.map((p) => (
                <span
                    key={p.id}
                    style={{
                        left: `${p.left}%`,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                        transform: `rotate(${p.rotate}deg)`,
                        background: p.color,
                    }}
                />
            ))}
        </div>
    )
}