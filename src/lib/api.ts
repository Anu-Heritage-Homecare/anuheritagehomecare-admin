/**
 * The one HTTP client for the admin. Every backend call goes through here so the
 * bearer token, the single refresh-on-401 and error shaping live in one place.
 */
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setSession,
  type AdminSession,
} from './auth-storage'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

/** A failed response, carrying the backend status and message for the UI. */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** Fired when the session cannot be refreshed; the auth provider signs out. */
export const AUTH_LOGOUT_EVENT = 'admin:auth-logout'

/** Pull a readable string out of a backend `message`, which may be a string, an
 * array of validation strings, or a nested `{ message }` object (the shape the
 * API wraps validation errors in). Anything else falls back to the status text. */
function readMessage(raw: unknown, fallback: string): string {
  if (Array.isArray(raw)) return raw.join(', ')
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'message' in raw) {
    return readMessage((raw as { message?: unknown }).message, fallback)
  }
  return fallback
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = res.statusText
  let code: string | undefined
  try {
    const body = (await res.json()) as { message?: unknown; code?: string }
    message = readMessage(body.message, res.statusText)
    code = body.code
  } catch {
    // Non JSON error body; the status text is the best we have.
  }
  return new ApiError(res.status, message, code)
}

// Single flight: many queries can 401 at once, but only one refresh runs.
let refreshing: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  const res = await fetch(`${API_URL}/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) return false
  setSession((await res.json()) as AdminSession)
  return true
}

function refreshOnce(): Promise<boolean> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null
  })
  return refreshing
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Attach the bearer token. Off for login and refresh. Default on. */
  auth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options

  const send = (): Promise<Response> => {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const token = auth ? getAccessToken() : null
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  let res = await send()
  if (res.status === 401 && auth && getRefreshToken()) {
    if (await refreshOnce()) {
      res = await send()
    } else {
      clearSession()
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
    }
  }

  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
}

/** Authenticate; unauthenticated, so it never carries a stale bearer token. */
export function login(email: string, password: string): Promise<AdminSession> {
  return request<AdminSession>('/admin/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  })
}

/** Best effort server side sign out; local sign out proceeds regardless. */
export function logoutRequest(refreshToken: string): Promise<void> {
  return request<void>('/admin/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  }).catch(() => undefined)
}
