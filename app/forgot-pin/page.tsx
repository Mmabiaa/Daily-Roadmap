'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'

type Step = 'request' | 'verify'

export default function ForgotPinPage() {
  const [step, setStep] = useState<Step>('request')
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  /** Ask the server to email a fresh code. Also used by the "Resend" button. */
  const sendCode = async () => {
    setError('')
    setNotice('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Could not send the code')
        return
      }

      setNotice(data.message || 'Check your email for the code.')
      setStep('verify')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (pin !== confirm) {
      setError('Those PINs do not match')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp, pin }),
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Could not reset your PIN')
        setLoading(false)
        return
      }

      // A successful reset signs you in and sets a fresh cookie.
      window.location.replace('/')
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <main className="signin-page">
      <section className="signin-card" aria-labelledby="forgot-title">
        <header className="signin-header">
          <div className="signin-header-copy">
            <h1 id="forgot-title">Reset your PIN</h1>
            <p className="signin-copy">
              {step === 'request'
                ? 'Tell us your username or email and we’ll send a 6-digit code.'
                : `Enter the code we sent you, then choose a new PIN.`}
            </p>
          </div>
          <div className="signin-logo">
            <Image src="https://i.pinimg.com/1200x/f8/98/bf/f898bfb34a80f0784e1417c86a096e13.jpg" alt="Daily Roadmap" width={56} height={56} priority />
          </div>
        </header>

        {step === 'request' ? (
          <form
            className="signin-form"
            onSubmit={(e) => {
              e.preventDefault()
              sendCode()
            }}
          >
            <div className="signin-field">
              <label htmlFor="identifier">Username or email</label>
              <input
                id="identifier"
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                aria-invalid={!!error}
                placeholder="mmabiaa"
              />
            </div>

            {error && (
              <p className="signin-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="signin-submit" disabled={loading}>
              {loading && <span className="signin-spinner" aria-hidden="true" />}
              {loading ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        ) : (
          <form className="signin-form" onSubmit={handleReset}>
            {notice && <p className="signin-notice">{notice}</p>}

            <div className="signin-field">
              <label htmlFor="otp">6-digit code</label>
              <input
                id="otp"
                type="text"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                aria-invalid={!!error}
                placeholder="000000"
              />
            </div>

            <div className="signin-field">
              <label htmlFor="new-pin">New PIN</label>
              <div className="signin-input-wrap">
                <input
                  id="new-pin"
                  type={showPin ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  inputMode="numeric"
                  pattern="\d{4,8}"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  aria-invalid={!!error}
                  placeholder="4 to 8 digits"
                />
                <button
                  type="button"
                  className="signin-reveal"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  aria-pressed={showPin}
                >
                  {showPin ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="signin-field">
              <label htmlFor="confirm-pin">Confirm new PIN</label>
              <input
                id="confirm-pin"
                type={showPin ? 'text' : 'password'}
                required
                autoComplete="new-password"
                inputMode="numeric"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={!!error}
                placeholder="Repeat your PIN"
              />
            </div>

            {error && (
              <p className="signin-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="signin-submit" disabled={loading}>
              {loading && <span className="signin-spinner" aria-hidden="true" />}
              {loading ? 'Saving…' : 'Set new PIN'}
            </button>

            <button type="button" className="signin-secondary" onClick={sendCode} disabled={loading}>
              Resend code
            </button>

            <button
              type="button"
              className="signin-secondary"
              onClick={() => {
                setStep('request')
                setError('')
                setNotice('')
              }}
              disabled={loading}
            >
              Use a different account
            </button>
          </form>
        )}

        <p className="signin-links">
          <span>
            Remembered it? <Link href="/signin">Back to sign in</Link>
          </span>
        </p>
      </section>
    </main>
  )
}
