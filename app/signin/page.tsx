'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function SignInPage() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // No useEffect needed — middleware already redirects authenticated users away from /signin

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Sign in failed')
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
      <section className="signin-card" aria-labelledby="signin-title">
        <header className="signin-header">
          <div className="signin-header-copy">
            <h1 id="signin-title">Welcome back</h1>
            <p className="signin-copy">Sign in to open your schedule.</p>
          </div>
          <div className="signin-logo">
            {/* Put your logo in /public and update the src (PNG, SVG or WebP) */}
            <Image src="https://i.pinimg.com/1200x/f8/98/bf/f898bfb34a80f0784e1417c86a096e13.jpg" alt="Your app name" width={56} height={56} priority />
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
              aria-describedby={error ? 'signin-error' : undefined}
              placeholder="mmabiaa"
            />
          </div>

          <div className="signin-field">
            <label htmlFor="pin">PIN</label>
            <div className="signin-input-wrap">
              <input
                id="pin"
                type={showPin ? 'text' : 'password'}
                required
                autoComplete="current-password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? 'signin-error' : undefined}
                placeholder="••••"
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

          {error && (
            <p id="signin-error" className="signin-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="signin-submit" disabled={loading}>
            {loading && <span className="signin-spinner" aria-hidden="true" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="signin-links">
          <span>
            No account yet? <Link href="/signup">Create one</Link>
          </span>
          <span>
            <Link href="/forgot-pin">Forgot your PIN?</Link>
          </span>
        </p>
      </section>
    </main>
  )
}