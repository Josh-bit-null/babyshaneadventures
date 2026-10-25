import express from 'express'
import {
  PIN_RE,
  USERNAME_RE,
  clearRateLimit,
  cookieOptions,
  hashPin,
  rateLimit,
  requireAuth,
  signSession,
  verifyPin,
} from '../auth.js'
import { getConfig } from '../config.js'
import {
  defaultAvatar,
  sanitizeAvatar,
  sanitizeAvatarUrl,
} from '../content/avatars.js'
import {
  createUser as createUserRow,
  findUserById,
  findUserByUsername,
  publicUser,
  updateUserAvatar,
} from '../repo.js'
import { sanitizeText } from '../utils.js'

export const authRouter = express.Router()

const avatarFor = (persona) => defaultAvatar(persona)

authRouter.post('/login', async (req, res) => {
  const config = getConfig()
  const username = String(req.body?.username ?? '').toLowerCase().trim()
  const pin = String(req.body?.pin ?? '')
  if (!USERNAME_RE.test(username) || !PIN_RE.test(pin)) {
    res.status(400).json({ error: 'Use your username and 4–8 digit PIN.' })
    return
  }

  const limit = rateLimit(`login:${req.ip}:${username}`)
  if (!limit.allowed) {
    res.status(429).json({ error: `Too many attempts. Try again in ${limit.retryAfter}s.` })
    return
  }

  const row = await findUserByUsername(username)
  if (!row || !verifyPin(pin, row.pin_hash)) {
    res.status(401).json({ error: 'That username and PIN do not match.' })
    return
  }

  clearRateLimit(`login:${req.ip}:${username}`)
  const token = signSession(row, config)
  res.cookie(config.cookieName, token, cookieOptions(config))
  res.json({ user: publicUser(row) })
})

authRouter.post('/register', async (req, res) => {
  const config = getConfig()
  const username = String(req.body?.username ?? '').toLowerCase().trim()
  const pin = String(req.body?.pin ?? '')
  const displayName = sanitizeText(req.body?.displayName, 24)
  const persona = ['mushroom', 'siopao', 'guest'].includes(req.body?.persona)
    ? req.body.persona
    : 'guest'

  if (!USERNAME_RE.test(username)) {
    res.status(400).json({
      error: 'Username must be 3–20 characters: lowercase letters, numbers or _.',
    })
    return
  }
  if (!PIN_RE.test(pin)) {
    res.status(400).json({ error: 'PIN must be 4–8 digits.' })
    return
  }
  if (displayName.length < 2) {
    res.status(400).json({ error: 'Display name needs at least 2 characters.' })
    return
  }

  const limit = rateLimit(`register:${req.ip}`, { max: 6 })
  if (!limit.allowed) {
    res.status(429).json({ error: 'Too many sign-ups from this device. Try later.' })
    return
  }

  if (await findUserByUsername(username)) {
    res.status(409).json({ error: 'That username is already on the island.' })
    return
  }

  const avatar = avatarFor(persona)
  const row = await createUserRow({
    username,
    displayName,
    pinHash: hashPin(pin),
    avatar,
    coins: 350,
  })
  const token = signSession(row, config)
  res.cookie(config.cookieName, token, cookieOptions(config))
  res.status(201).json({ user: publicUser(row) })
})

authRouter.post('/logout', (req, res) => {
  const config = getConfig()
  res.clearCookie(config.cookieName, { ...cookieOptions(config), maxAge: undefined })
  res.json({ ok: true })
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const row = await findUserById(req.user.id)
  if (!row) {
    res.clearCookie(getConfig().cookieName)
    res.status(401).json({ error: 'Your session is no longer valid.' })
    return
  }
  res.json({ user: publicUser(row) })
})

authRouter.patch('/avatar', requireAuth, async (req, res) => {
  const rawUrl = req.body?.rpmAvatarUrl
  const rpmAvatarUrl = sanitizeAvatarUrl(rawUrl)
  if (rawUrl != null && rawUrl !== '' && rpmAvatarUrl == null) {
    res.status(400).json({ error: 'Avatar URL must be a valid http(s) .glb URL.' })
    return
  }
  const avatarConfig = sanitizeAvatar(req.body?.avatarConfig, 'guest')
  const row = await updateUserAvatar(req.user.id, { avatarConfig, rpmAvatarUrl })
  res.json({ user: publicUser(row) })
})
