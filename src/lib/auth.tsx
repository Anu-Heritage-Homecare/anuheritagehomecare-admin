/**
 * Who is signed in, for the whole admin. Holds the current admin profile in
 * React state (mirrored from localStorage) and exposes sign in and sign out.
 * The HTTP layer owns token refresh; when a refresh fails it fires a logout
 * event that this provider listens for, so an expired session clears the UI.
 *
 * The hook and helpers live in `auth-context` so this file exports only the
 * provider component (fast refresh wants component-only modules).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AUTH_LOGOUT_EVENT, login as loginRequest, logoutRequest } from './api'
import {
  clearSession,
  getRefreshToken,
  getStoredAdmin,
  setSession,
  type AdminProfile,
} from './auth-storage'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(() => getStoredAdmin())

  useEffect(() => {
    const onLogout = () => setAdmin(null)
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout)
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await loginRequest(email, password)
    setSession(session)
    setAdmin(session.admin)
  }, [])

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) await logoutRequest(refreshToken)
    clearSession()
    setAdmin(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ admin, isAuthenticated: admin !== null, signIn, signOut }),
    [admin, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
