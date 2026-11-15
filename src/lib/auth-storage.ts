/**
 * The admin's persisted session. Kept in localStorage so a reload rehydrates
 * straight back into the app rather than bouncing to the login screen.
 *
 * Tokens in localStorage are the standard SPA trade-off: simple, but readable by
 * any script on the page, so this leans on the app staying XSS clean. Move to an
 * httpOnly refresh cookie if the backend grows one.
 */

/** The authenticated admin, as returned by the backend auth endpoints. */
export interface AdminProfile {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: string
  photoKey: string | null
  mustChangePassword: boolean
  lastLoginAt: string | null
}

/** The full token pair plus profile returned by login and refresh. */
export interface AdminSession {
  tokenType: 'Bearer'
  accessToken: string
  refreshToken: string
  admin: AdminProfile
}

const ACCESS_KEY = 'admin.accessToken'
const REFRESH_KEY = 'admin.refreshToken'
const ADMIN_KEY = 'admin.profile'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function getStoredAdmin(): AdminProfile | null {
  const raw = localStorage.getItem(ADMIN_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminProfile
  } catch {
    return null
  }
}

export function setSession(session: AdminSession): void {
  localStorage.setItem(ACCESS_KEY, session.accessToken)
  localStorage.setItem(REFRESH_KEY, session.refreshToken)
  localStorage.setItem(ADMIN_KEY, JSON.stringify(session.admin))
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(ADMIN_KEY)
}
