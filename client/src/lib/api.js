const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export function apiUrl(path) {
  return `${API_BASE}${path}`
}

export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, timeout = 20_000, signal, headers = {} } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeout)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }

  try {
    const response = await fetch(apiUrl(path), {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const text = await response.text()
    let payload = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { error: text.slice(0, 200) }
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('bsa:unauthorized'))
      }
      throw new ApiError(
        payload?.error || `Request failed (${response.status})`,
        response.status,
        payload,
      )
    }
    return payload
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error?.name === 'AbortError') {
      throw new ApiError('The island took too long to answer. Try again.', 0, null)
    }
    throw new ApiError(
      navigator.onLine ? 'Could not reach the island server.' : 'You are offline.',
      0,
      null,
    )
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  get: (path, options) => apiFetch(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiFetch(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => apiFetch(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => apiFetch(path, { ...options, method: 'DELETE' }),
}

export const socketOrigin = API_BASE || window.location.origin
export { API_BASE }
