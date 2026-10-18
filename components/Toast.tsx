'use client'

type Props = {
    message: string
    tone?: 'success' | 'info'
}

export function Toast({ message, tone = 'info' }: Props) {
    return (
        <div className={`toast toast-${tone}`} role="status" aria-live="polite">
            <span className="toast-dot" aria-hidden="true" />
            {message}
        </div>
    )
}