import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { parse as parseCookie } from 'cookie'
import { getConfig } from './config.js'

const SCRYPT_KEYLEN = 32

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/
export const PIN_RE = /^\d{4,8}$/

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(pin), salt, SCRYPT_KEYLEN).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPin(pin, stored) {
  if (typeof stored !== 'string') return false
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = crypto.scryptSync(String(pin), salt, expected.length)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export function signSession(user, config = getConfig()) {
  return jwt.sign(
    {
      username: user.username,
      name: user.display_name ?? user.displayName ?? user.username,
    },
    config.jwtSecret,
    { subject: String(user.id), expiresIn: config.jwtTtl, issuer: 'babyshane' },
  )
}

export function readCookieToken(cookieHeader, config = getConfig()) {
  if (!cookieHeader) return null
  try {
    const cookies = parseCookie(cookieHeader)
    return cookies[config.cookieName] ?? null
  } catch {
    return null
  }
}

export function verifySession(token, config = getConfig()) {
  if (!token) return null
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'babyshane' })
    const id = Number(payload.sub)
    if (!Number.isInteger(id) || id <= 0) return null
    return { id, username: payload.username, name: payload.name }
  } catch {
    return null
  }
}

export function cookieOptions(config = getConfig()) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  }
}

/** Express middleware: JWT is read only from the HttpOnly cookie. */
export function requireAuth(req, res, next) {
  const config = getConfig()
  const user = verifySession(readCookieToken(req.headers.cookie, config), config)
  if (!user) {
    res.status(401).json({ error: 'Please sign in again.' })
    return
  }
  req.user = user
  next()
}

/** Socket.IO handshake middleware: validates the JWT before upgrade completes. */
export function socketAuth(socket, next) {
  const config = getConfig()
  const token = readCookieToken(socket.handshake.headers.cookie, config)
  const user = verifySession(token, config)
  if (!user) {
    next(new Error('unauthorized'))
    return
  }
  socket.data.user = user
  next()
}

/** Small in-memory brute-force guard for auth endpoints. */
const attempts = new Map()
export function rateLimit(key, { max = 12, windowMs = 10 * 60_000 } = {}) {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1 }
  }
  entry.count += 1
  if (entry.count > max) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { allowed: true, remaining: max - entry.count }
}

export function clearRateLimit(key) {
  attempts.delete(key)
}
