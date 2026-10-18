'use client'

export function Ring({ value }: { value: number }) {
    const r = 30
    const c = 2 * Math.PI * r
    return (
        <div className="relative size-[76px] shrink-0">
            <svg viewBox="0 0 76 76" className="size-full -rotate-90">
                <circle
                    cx="38"
                    cy="38"
                    r={r}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    className="text-muted/30"
                />
                <circle
                    cx="38"
                    cy="38"
                    r={r}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c - c * value}
                    className="text-primary transition-all duration-500"
                />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-sm font-semibold">
                {Math.round(value * 100)}%
            </span>
        </div>
    )
}