import crypto from 'node:crypto'
import { socketAuth } from '../auth.js'
import { CATALOG_BY_SKU, THEME_BY_SKU } from '../content/catalog.js'
import { roomEvents } from '../events.js'
import {
  addItemToInventory,
  ensureRoom,
  findUserById,
  getRoom,
  inventoryForRoom,
  normalizeWorldState,
  saveWorld,
  setRoomSockets,
} from '../repo.js'
import { DEFAULT_ROOM, clamp, sanitizeRoomId, sanitizeText } from '../utils.js'

const POMODORO_MS = 25 * 60_000
const MAX_ROOM_USERS = 8
const EMPTY_ROOM_TTL = 10 * 60_000
const SPAWNS = [
  [0, 0, 6.0],
  [2.1, 0, 6.0],
  [-2.1, 0, 6.0],
  [0, 0, 7.2],
  [3.1, 0, 6.8],
  [-3.1, 0, 6.8],
  [1.2, 0, 7.8],
  [-1.2, 0, 7.8],
]

const profileOf = (entry) => ({
  id: entry.userId,
  name: entry.name,
  avatarConfig: entry.avatarConfig,
  rpmAvatarUrl: entry.rpmAvatarUrl,
  voiceEnabled: entry.voiceEnabled,
  joinedAt: entry.joinedAt,
})

const worldSnapshot = (rt) => ({
  room: { id: rt.id, theme: rt.theme, worldState: rt.world },
})

/**
 * Realtime layer: one authoritative runtime per room, 20Hz transform broadcast,
 * strict per-event validation, duplicate-session eviction, and JSON world state
 * persisted to MariaDB (or SQLite in local dev).
 */
export function attachRealtime(io, config) {
  const rooms = new Map()
  const tickMs = Math.round(1000 / config.tickRate)
  let tickTimer = null
  let stopped = false

  io.use(socketAuth)

  function runtimeFor(roomId) {
    return rooms.get(roomId) ?? null
  }

  async function loadRuntime(roomId) {
    const existing = runtimeFor(roomId)
    if (existing) return existing
    await ensureRoom(roomId)
    const room = await getRoom(roomId)
    const rt = {
      id: roomId,
      users: new Map(),
      world: normalizeWorldState(room?.worldState),
      theme: room?.theme ?? 'theme-meadow',
      pomodoroTimer: null,
      cleanupTimer: null,
      lastPersist: 0,
    }
    reconcilePomodoro(rt)
    rooms.set(roomId, rt)
    return rt
  }

  async function persistSockets(rt) {
    try {
      await setRoomSockets(rt.id, [...rt.users.values()].map((entry) => entry.socket.id))
    } catch (error) {
      console.warn('[rooms] could not persist sockets:', error.message)
    }
  }

  async function persistWorld(rt) {
    rt.lastPersist = Date.now()
    try {
      await saveWorld(rt.id, rt.world)
    } catch (error) {
      console.warn('[rooms] could not persist world:', error.message)
    }
  }

  function broadcastPlayers(rt) {
    io.to(rt.id).emit('room:players', {
      players: [...rt.users.values()].map(profileOf),
    })
  }

  function clearPomodoroTimer(rt) {
    if (rt.pomodoroTimer) {
      clearTimeout(rt.pomodoroTimer)
      rt.pomodoroTimer = null
    }
  }

  function schedulePomodoro(rt) {
    clearPomodoroTimer(rt)
    const pomo = rt.world.pomodoro
    if (pomo.status !== 'running') return
    const remaining = Math.max(0, pomo.endsAt - Date.now())
    rt.pomodoroTimer = setTimeout(() => finishPomodoro(rt, pomo.sessionId), remaining + 50)
    if (rt.pomodoroTimer.unref) rt.pomodoroTimer.unref()
  }

  function reconcilePomodoro(rt) {
    const pomo = rt.world.pomodoro
    if (pomo.status !== 'running') return
    if (!pomo.endsAt || pomo.endsAt <= Date.now()) {
      pomo.status = 'complete'
      pomo.completedAt = new Date().toISOString()
      pomo.plantHealth = 1
      pomo.endsAt = null
      saveWorld(rt.id, rt.world).catch(() => {})
      return
    }
    schedulePomodoro(rt)
  }

  async function finishPomodoro(rt, sessionId) {
    const pomo = rt.world.pomodoro
    if (pomo.status !== 'running' || pomo.sessionId !== sessionId) return
    pomo.status = 'complete'
    pomo.completedAt = new Date().toISOString()
    pomo.plantHealth = 1
    pomo.endsAt = null
    rt.pomodoroTimer = null
    await persistWorld(rt)
    io.to(rt.id).emit('pomodoro:complete', {
      worldState: rt.world,
      message: '25 minutes of shared focus complete. Sprout is thriving.',
    })
    await emitWorldUpdate(rt.id, 'pomodoro-complete')
  }

  async function failPomodoro(rt, { userId, userName, reason }) {
    const pomo = rt.world.pomodoro
    if (pomo.status !== 'running') return
    clearPomodoroTimer(rt)
    pomo.status = 'failed'
    pomo.plantHealth = 0
    pomo.failedBy = userId
    pomo.failedByName = userName
    pomo.failedReason = reason
    pomo.failedAt = new Date().toISOString()
    await persistWorld(rt)
    io.to(rt.id).emit('pomodoro:failed', {
      worldState: rt.world,
      message:
        reason === 'hidden'
          ? `${userName} left the tab. Sprout wilted.`
          : `${userName} slipped away. Sprout wilted.`,
      reason,
    })
    await emitWorldUpdate(rt.id, 'pomodoro-failed')
  }

  async function emitWorldUpdate(roomId, reason = 'update') {
    const rt = runtimeFor(roomId)
    if (!rt) return
    const [room, inventory] = await Promise.all([
      getRoom(roomId),
      inventoryForRoom(roomId, 0),
    ])
    if (!room) return
    rt.world = normalizeWorldState(room.worldState)
    rt.theme = room.theme
    io.to(roomId).emit('world:update', {
      room: { id: roomId, theme: room.theme, worldState: rt.world },
      inventory: inventory.items,
      reason,
    })
  }

  const onWorldChanged = ({ roomId, reason }) => {
    emitWorldUpdate(roomId, reason).catch((error) =>
      console.warn('[rooms] world broadcast failed:', error.message),
    )
  }
  const onCoinsChanged = ({ userId, coins }) => {
    io.to(`user:${userId}`).emit('coins:update', { coins })
  }
  roomEvents.on('world:changed', onWorldChanged)
  roomEvents.on('coins:changed', onCoinsChanged)

  async function leave(socket, { silent = false } = {}) {
    const roomId = socket.data.roomId
    if (!roomId) return
    const rt = runtimeFor(roomId)
    socket.data.roomId = null
    socket.leave(roomId)
    if (!rt) return
    const userId = socket.data.user?.id
    const entry = rt.users.get(userId)
    if (!entry || entry.socket.id !== socket.id) return

    if (rt.world.pomodoro.status === 'running') {
      await failPomodoro(rt, {
        userId: entry.userId,
        userName: entry.name,
        reason: silent ? 'disconnected' : 'left',
      })
    }

    rt.users.delete(userId)
    await persistSockets(rt)
    broadcastPlayers(rt)
    if (!silent) {
      socket.to(roomId).emit('presence:toast', {
        type: 'leave',
        message: `${entry.name} wandered off the island.`,
      })
    }
    if (rt.users.size === 0) {
      clearPomodoroTimer(rt)
      if (rt.cleanupTimer) clearTimeout(rt.cleanupTimer)
      rt.cleanupTimer = setTimeout(() => {
        const current = runtimeFor(roomId)
        if (current && current.users.size === 0) rooms.delete(roomId)
      }, EMPTY_ROOM_TTL)
      if (rt.cleanupTimer.unref) rt.cleanupTimer.unref()
    }
  }

  io.on('connection', (socket) => {
    const id = socket.data.user.id
    socket.join(`user:${id}`)
    let stateWindow = { start: Date.now(), count: 0 }

    socket.on('room:join', async (payload, ack) => {
      try {
        const roomId = sanitizeRoomId(payload?.roomId ?? DEFAULT_ROOM)
        if (!roomId) {
          ack?.({ ok: false, error: 'Invalid room code.' })
          return
        }
        if (socket.data.roomId && socket.data.roomId !== roomId) {
          await leave(socket)
        }

        const rt = await loadRuntime(roomId)
        const userRow = await findUserById(id)
        if (!userRow) {
          ack?.({ ok: false, error: 'Your account no longer exists.' })
          return
        }
        if (!rt.users.has(id) && rt.users.size >= MAX_ROOM_USERS) {
          ack?.({ ok: false, error: 'This room is full (8 explorers max).' })
          return
        }

        const existing = rt.users.get(id)
        if (existing && existing.socket.id !== socket.id) {
          existing.socket.emit('session:replaced', {
            message: 'Your account opened somewhere else.',
          })
          existing.socket.disconnect(true)
        }

        socket.data.roomId = roomId
        socket.join(roomId)
        if (rt.cleanupTimer) {
          clearTimeout(rt.cleanupTimer)
          rt.cleanupTimer = null
        }

        const spawn = SPAWNS[rt.users.size % SPAWNS.length]
        const entry = {
          userId: id,
          name: userRow.display_name,
          avatarConfig: safeJson(userRow.avatar_config),
          rpmAvatarUrl: userRow.rpm_avatar_url ?? null,
          voiceEnabled: false,
          socket,
          joinedAt: new Date().toISOString(),
          p: existing?.p ?? [...spawn],
          q: existing?.q ?? [0, 0, 0, 1],
          moving: false,
        }
        rt.users.set(id, entry)
        await persistSockets(rt)
        const inventory = await inventoryForRoom(roomId, id)

        const players = [...rt.users.values()].map(profileOf)
        ack?.({
          ok: true,
          self: { ...profileOf(entry), p: entry.p, q: entry.q },
          room: { id: roomId, theme: rt.theme, worldState: rt.world },
          inventory: inventory.items,
          players,
          tickRate: config.tickRate,
        })
        broadcastPlayers(rt)
        socket.to(roomId).emit('presence:toast', {
          type: 'join',
          message: `${entry.name} is here.`,
        })
      } catch (error) {
        console.error('[rooms] join failed:', error)
        ack?.({ ok: false, error: 'Could not join that room.' })
      }
    })

    socket.on('player:state', (payload) => {
      const now = Date.now()
      if (now - stateWindow.start > 1000) stateWindow = { start: now, count: 0 }
      stateWindow.count += 1
      if (stateWindow.count > 60) return // hard cap: 3× the tick rate

      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry) return
      const { p, q, moving } = payload ?? {}
      if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) return
      if (!Array.isArray(q) || q.length !== 4 || !q.every(Number.isFinite)) return
      const length = Math.hypot(q[0], q[1], q[2], q[3])
      if (length < 0.5 || length > 1.5) return

      entry.p = [
        Number(clamp(p[0], -20, 20).toFixed(3)),
        Number(clamp(p[1], 0, 6).toFixed(3)),
        Number(clamp(p[2], -20, 20).toFixed(3)),
      ]
      entry.q = q.map((value) => Number(clamp(value, -1, 1).toFixed(4)))
      entry.moving = Boolean(moving)
    })

    socket.on('profile:refresh', async () => {
      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry) return
      const row = await findUserById(id)
      if (!row) return
      entry.name = row.display_name
      entry.avatarConfig = safeJson(row.avatar_config)
      entry.rpmAvatarUrl = row.rpm_avatar_url ?? null
      broadcastPlayers(rt)
    })

    socket.on('voice:state', (payload) => {
      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry) return
      entry.voiceEnabled = Boolean(payload?.enabled)
      broadcastPlayers(rt)
    })

    socket.on('rtc:signal', (payload) => {
      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry) return
      const targetId = Number(payload?.to)
      if (!Number.isInteger(targetId) || targetId === id) return
      const target = rt.users.get(targetId)
      if (!target) return
      let serialized
      try {
        serialized = JSON.stringify(payload?.data ?? null)
      } catch {
        return
      }
      if (!serialized || serialized.length > 24_000) return
      target.socket.emit('rtc:signal', {
        from: id,
        fromName: entry.name,
        data: payload.data,
      })
    })

    socket.on('pomodoro:start', async (_payload, ack) => {
      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry) {
        ack?.({ ok: false, error: 'Join a room first.' })
        return
      }
      if (rt.world.pomodoro.status === 'running') {
        ack?.({ ok: false, error: 'A focus session is already running.' })
        return
      }
      const sessionId = crypto.randomUUID()
      const now = Date.now()
      rt.world.pomodoro = {
        status: 'running',
        durationMs: POMODORO_MS,
        startedAt: new Date(now).toISOString(),
        endsAt: now + POMODORO_MS,
        startedBy: id,
        startedByName: entry.name,
        sessionId,
        plantHealth: 1,
        failedBy: null,
        failedByName: null,
        failedReason: null,
        failedAt: null,
        completedAt: null,
      }
      await persistWorld(rt)
      schedulePomodoro(rt)
      ack?.({ ok: true, worldState: rt.world })
      io.to(rt.id).emit('pomodoro:started', {
        worldState: rt.world,
        message: `${entry.name} locked in a 25-minute co-op focus session.`,
      })
      await emitWorldUpdate(rt.id, 'pomodoro-start')
    })

    socket.on('pomodoro:distracted', async (payload) => {
      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry) return
      await failPomodoro(rt, {
        userId: id,
        userName: entry.name,
        reason: payload?.reason === 'hidden' ? 'hidden' : 'left',
      })
    })

    socket.on('pomodoro:cancel', async () => {
      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry || rt.world.pomodoro.status !== 'running') return
      await failPomodoro(rt, {
        userId: id,
        userName: entry.name,
        reason: 'cancelled',
      })
    })

    socket.on('chore:claim', async (payload, ack) => {
      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry) return
      const chore = rt.world.chores.find((item) => item.id === payload?.choreId)
      if (!chore) {
        ack?.({ ok: false, error: 'Unknown chore.' })
        return
      }
      if (chore.status !== 'open') {
        ack?.({ ok: false, error: 'Someone already claimed that one.' })
        return
      }
      chore.status = 'pending'
      chore.claimedBy = id
      chore.claimedByName = entry.name
      chore.claimedAt = new Date().toISOString()
      await persistWorld(rt)
      ack?.({ ok: true })
      io.to(rt.id).emit('chore:update', {
        worldState: rt.world,
        message: `${entry.name} finished “${chore.label}”. ${entry.name.split(' ')[0]}, ask your partner to verify!`,
      })
      await emitWorldUpdate(rt.id, 'chore-claim')
    })

    socket.on('chore:release', async (payload, ack) => {
      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry) return
      const chore = rt.world.chores.find((item) => item.id === payload?.choreId)
      if (!chore || chore.status !== 'pending' || chore.claimedBy !== id) {
        ack?.({ ok: false, error: 'You cannot release that task.' })
        return
      }
      chore.status = 'open'
      chore.claimedBy = null
      chore.claimedByName = null
      chore.claimedAt = null
      await persistWorld(rt)
      ack?.({ ok: true })
      io.to(rt.id).emit('chore:update', { worldState: rt.world })
      await emitWorldUpdate(rt.id, 'chore-release')
    })

    socket.on('chore:verify', async (payload, ack) => {
      const rt = runtimeFor(socket.data.roomId)
      const entry = rt?.users.get(id)
      if (!rt || !entry) return
      const chore = rt.world.chores.find((item) => item.id === payload?.choreId)
      if (!chore) {
        ack?.({ ok: false, error: 'Unknown chore.' })
        return
      }
      if (chore.status !== 'pending') {
        ack?.({ ok: false, error: 'That task is not waiting for verification.' })
        return
      }
      if (chore.claimedBy === id) {
        ack?.({ ok: false, error: 'Your partner has to verify this one.' })
        return
      }
      const reward = CATALOG_BY_SKU.get(chore.rewardSku)
      if (!reward) {
        ack?.({ ok: false, error: 'Reward is unavailable.' })
        return
      }

      try {
        await addItemToInventory({
          roomId: rt.id,
          userId: 0,
          sku: reward.sku,
          source: 'chore',
        })
      } catch (error) {
        console.error('[chores] reward failed:', error)
        ack?.({ ok: false, error: 'Could not deliver the reward.' })
        return
      }

      chore.status = 'done'
      chore.verifiedBy = id
      chore.verifiedByName = entry.name
      chore.completedAt = new Date().toISOString()
      await persistWorld(rt)
      ack?.({ ok: true })
      io.to(rt.id).emit('chore:verified', {
        worldState: rt.world,
        reward,
        message: `Verified! ${reward.name} appeared in your shared home.`,
      })
      await emitWorldUpdate(rt.id, 'chore-verified')
    })

    socket.on('disconnect', () => {
      leave(socket, { silent: true }).catch((error) =>
        console.warn('[rooms] leave failed:', error.message),
      )
    })
  })

  tickTimer = setInterval(() => {
    if (stopped) return
    const t = Date.now()
    for (const rt of rooms.values()) {
      if (!rt.users.size) continue
      const players = [...rt.users.values()].map((entry) => ({
        id: entry.userId,
        name: entry.name,
        p: entry.p,
        q: entry.q,
        moving: entry.moving,
        voiceEnabled: entry.voiceEnabled,
      }))
      io.to(rt.id).emit('room:tick', { t, players })
    }
  }, tickMs)
  if (tickTimer.unref) tickTimer.unref()

  return {
    get rooms() {
      return rooms
    },
    emitWorldUpdate,
    stop() {
      stopped = true
      clearInterval(tickTimer)
      roomEvents.off('world:changed', onWorldChanged)
      roomEvents.off('coins:changed', onCoinsChanged)
      for (const rt of rooms.values()) {
        clearPomodoroTimer(rt)
        if (rt.cleanupTimer) clearTimeout(rt.cleanupTimer)
      }
      rooms.clear()
    },
  }
}

function safeJson(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const __test = { POMODORO_MS, MAX_ROOM_USERS }
