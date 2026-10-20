'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'

export default function SignUpPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (pin !== confirm) {
      setError('Those PINs do not match')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, pin }),
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Sign up failed')
        setLoading(false)
        return
      }

      // Full navigation so the browser sends the new cookie with the request
      window.location.replace('/')
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <main className="signin-page">
      <section className="signin-card" aria-labelledby="signup-title">
        <header className="signin-header">
          <div className="signin-header-copy">
            <h1 id="signup-title">Create your account</h1>
            <p className="signin-copy">Your own plan and progress, kept separate from everyone else&rsquo;s.</p>
          </div>
          <div className="signin-logo">
            <Image src="https://i.pinimg.com/1200x/f8/98/bf/f898bfb34a80f0784e1417c86a096e13.jpg" alt="Daily Roadmap" width={56} height={56} priority />
          </div>
        </header>

        <form className="signin-form" onSubmit={handleSubmit}>
          <div className="signin-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={!!error}
              placeholder="mmabiaa"
            />
          </div>

          <div className="signin-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              placeholder="you@example.com"
            />
          </div>

          <div className="signin-field">
            <label htmlFor="pin">PIN</label>
            <div className="signin-input-wrap">
              <input
                id="pin"
                type={showPin ? 'text' : 'password'}
                required
                autoComplete="new-password"
                inputMode="numeric"
                pattern="\d{6,8}"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                aria-invalid={!!error}
                placeholder="6 to 8 digits"
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
            <label htmlFor="confirm">Confirm PIN</label>
            <input
              id="confirm"
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="signin-links">
          <span>
            Already have an account? <Link href="/signin">Sign in</Link>
          </span>
        </p>
      </section>
    </main>
  )
}
