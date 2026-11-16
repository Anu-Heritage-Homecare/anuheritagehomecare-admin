import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

/** The admin sign in screen, full screen and outside the authenticated shell. */
export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  if (isAuthenticated) return <Navigate to={from} replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to sign in. Please check your connection and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-canvas flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="text-ink text-xl font-bold tracking-tight">Sign in</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Access the Careprofs operations console.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              >
                {error}
              </p>
            )}

            <div>
              <label htmlFor="email" className="text-ink mb-1.5 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-line bg-surface text-ink placeholder:text-ink-subtle focus:border-brand-400 h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="you@anuheritagehomecare.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-ink mb-1.5 block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-line bg-surface text-ink placeholder:text-ink-subtle focus:border-brand-400 h-11 w-full rounded-lg border px-3 text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={busy || email === '' || password === ''}
              className="bg-brand-600 hover:bg-brand-700 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
