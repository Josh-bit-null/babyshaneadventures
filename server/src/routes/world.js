import express from 'express'
import { requireAuth } from '../auth.js'
import { publicCatalog, THEME_BY_SKU } from '../content/catalog.js'
import { roomEvents } from '../events.js'
import {
  ensureRoom,
  findUserById,
  inventoryForRoom,
  publicUser,
  purchaseItem,
  setRoomTheme,
  updateItemTransform,
  writeScreenTimeSubmission,
} from '../repo.js'
import { sanitizeRoomId, sanitizeTransform, sanitizeText } from '../utils.js'

export const worldRouter = express.Router()

async function roomIdOrFail(req, res) {
  const roomId = sanitizeRoomId(req.params.roomId ?? req.body?.roomId)
  if (!roomId) {
    res.status(400).json({ error: 'Room code must be 3–32 lowercase letters, numbers or dashes.' })
    return null
  }
  return roomId
}

worldRouter.get('/store/catalog', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300')
  res.json(publicCatalog())
})

worldRouter.get('/world/:roomId', requireAuth, async (req, res) => {
  const roomId = await roomIdOrFail(req, res)
  if (!roomId) return
  await ensureRoom(roomId)
  const [user, inventory] = await Promise.all([
    findUserById(req.user.id),
    inventoryForRoom(roomId, req.user.id),
  ])
  if (!user) {
    res.status(401).json({ error: 'Session expired.' })
    return
  }
  res.json({
    user: publicUser(user),
    room: { id: roomId, theme: inventory.theme, worldState: inventory.worldState },
    inventory: inventory.items,
    catalog: publicCatalog(),
  })
})

worldRouter.post('/store/purchase', requireAuth, async (req, res) => {
  const roomId = await roomIdOrFail(req, res)
  if (!roomId) return
  const sku = sanitizeText(req.body?.sku, 64)
  if (!sku) {
    res.status(400).json({ error: 'Choose an item to buy.' })
    return
  }
  await ensureRoom(roomId)
  try {
    const result = await purchaseItem({ roomId, userId: req.user.id, sku })
    const inventory = await inventoryForRoom(roomId, req.user.id)
    roomEvents.emit('world:changed', { roomId, reason: 'purchase' })
    res.json({
      item: result.item,
      user: result.user,
      theme: inventory.theme,
      inventory: inventory.items,
    })
  } catch (error) {
    if (error.code === 'INSUFFICIENT_COINS') {
      res.status(402).json({ error: 'Not enough coins yet — win a screen-time duel or ace a quiz!' })
      return
    }
    res.status(error.status || 400).json({ error: error.message })
  }
})

worldRouter.post('/rooms/:roomId/theme', requireAuth, async (req, res) => {
  const roomId = await roomIdOrFail(req, res)
  if (!roomId) return
  const sku = sanitizeText(req.body?.themeSku, 64)
  if (!THEME_BY_SKU.has(sku)) {
    res.status(400).json({ error: 'Unknown theme.' })
    return
  }
  const inventory = await inventoryForRoom(roomId, req.user.id)
  const owns = sku === 'theme-meadow' || inventory.mine.some((item) => item.sku === sku)
  if (!owns) {
    res.status(403).json({ error: 'Buy the theme before applying it.' })
    return
  }
  await setRoomTheme(roomId, sku)
  roomEvents.emit('world:changed', { roomId, reason: 'theme' })
  res.json({ theme: sku })
})

worldRouter.patch('/inventory/items/:uid', requireAuth, async (req, res) => {
  const roomId = await roomIdOrFail(req, res)
  if (!roomId) return
  const transform = sanitizeTransform(req.body)
  if (!transform) {
    res.status(400).json({ error: 'That placement is outside the island.' })
    return
  }
  try {
    const result = await updateItemTransform({
      roomId,
      userId: req.user.id,
      itemUid: req.params.uid,
      transform,
    })
    const inventory = await inventoryForRoom(roomId, req.user.id)
    roomEvents.emit('world:changed', { roomId, reason: 'placement' })
    res.json({ item: result.item, inventory: inventory.items })
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message })
  }
})

worldRouter.post('/screentime/submit', requireAuth, async (req, res) => {
  const roomId = await roomIdOrFail(req, res)
  if (!roomId) return
  const minutes = Number(req.body?.minutes)
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 100_000) {
    res.status(400).json({ error: 'Could not read a valid screen-time total.' })
    return
  }
  await ensureRoom(roomId)
  const user = await findUserById(req.user.id)
  if (!user) {
    res.status(401).json({ error: 'Session expired.' })
    return
  }

  const result = await writeScreenTimeSubmission({
    roomId,
    userId: user.id,
    userName: user.display_name,
    minutes,
  })
  const fresh = await findUserById(user.id)
  if (result.awarded && !result.awarded.tie) {
    const winner = await findUserById(result.awarded.winnerId)
    if (winner) {
      roomEvents.emit('coins:changed', {
        userId: winner.id,
        coins: Number(winner.coins),
      })
    }
  }
  roomEvents.emit('world:changed', { roomId, reason: 'screentime' })
  res.json({
    screenTime: result.screenTime,
    awarded: result.awarded,
    coins: Number(fresh.coins),
  })
})
