import { io } from 'socket.io-client'
import { socketOrigin } from '../lib/api.js'
import { pushSample } from './interpolation.js'

const TICK_SAMPLES = new Map()
const handlers = new Map()

let socket = null
let joinedRoom = null
let selfId = null
let joinAck = null
let pendingJoin = null
let hadConnection = false
let lastError = null

function dispatch(event, payload) {
  const set = handlers.get(event)
  if (!set) return
  for (const handler of [...set]) {
    try {
      handler(payload)
    } catch (error) {
      console.error(`[net] handler for ${event} failed`, error)
    }
  }
}

export function on(event, handler) {
  if (!handlers.has(event)) handlers.set(event, new Set())
  handlers.get(event).add(handler)
  return () => handlers.get(event)?.delete(handler)
}

function internal(event, payload) {
  if (event === 'room:tick') {
    const now = performance.now() / 1000
    const active = new Set()
    for (const player of payload?.players ?? []) {
      active.add(player.id)
      if (player.id === selfId) continue
      if (
        !Array.isArray(player.p) ||
        player.p.length !== 3 ||
        !Array.isArray(player.q) ||
        player.q.length !== 4
      ) {
        continue
      }
      const previous = TICK_SAMPLES.get(player.id) ?? []
      TICK_SAMPLES.set(
        player.id,
        pushSample(
          previous,
          { t: now, p: player.p, q: player.q, moving: Boolean(player.moving) },
          now,
        ),
      )
    }
    for (const id of TICK_SAMPLES.keys()) {
      if (!active.has(id)) TICK_SAMPLES.delete(id)
    }
  }

  if (event === 'room:players') {
    const active = new Set((payload?.players ?? []).map((player) => player.id))
    for (const id of TICK_SAMPLES.keys()) if (!active.has(id)) TICK_SAMPLES.delete(id)
  }

  if (event === 'session:replaced') {
    lastError = 'replaced'
  }

  dispatch(event, payload)
}

function joinRoom() {
  if (!socket || !joinedRoom) return
  const roomId = joinedRoom
  socket.emit('room:join', { roomId }, (ack) => {
    if (joinedRoom !== roomId) return
    if (!ack?.ok) {
      lastError = ack?.error || 'Could not join the room.'
      dispatch('room:error', { message: lastError })
      if (pendingJoin?.roomId === roomId) settlePendingJoin(new Error(lastError))
      return
    }
    if (ack.room?.id !== roomId) return
    selfId = ack.self.id
    joinAck = ack
    TICK_SAMPLES.clear()
    dispatch('room:joined', ack)
    if (pendingJoin?.roomId === roomId) settlePendingJoin(null, ack)
  })
}

function settlePendingJoin(error, ack) {
  if (!pendingJoin) return
  const pending = pendingJoin
  pendingJoin = null
  clearTimeout(pending.timer)
  if (error) pending.reject(error)
  else pending.resolve(ack)
}

function ensureSocket() {
  if (socket) return socket
  socket = io(socketOrigin, {
    withCredentials: true,
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 4000,
    timeout: 12_000,
  })

  socket.onAny((event, payload) => internal(event, payload))

  socket.on('connect', () => {
    const restored = hadConnection
    hadConnection = true
    if (restored) dispatch('connection:restored', { id: socket.id })
    else dispatch('connection:open', { id: socket.id })
    joinRoom()
  })

  socket.on('disconnect', (reason) => {
    dispatch('connection:closed', { reason })
  })

  socket.on('connect_error', (error) => {
    lastError = error?.message || 'Connection failed'
    dispatch('connect:error', { message: lastError })
    if (/unauthorized/i.test(lastError)) {
      settlePendingJoin(new Error('Please sign in again.'))
    }
  })

  return socket
}

export const net = {
  connect(roomId) {
    joinedRoom = roomId
    ensureSocket()
    if (socket.connected && joinAck?.room?.id === roomId) {
      return Promise.resolve(joinAck)
    }
    if (pendingJoin?.roomId === roomId) return pendingJoin.promise
    if (pendingJoin) settlePendingJoin(new Error('Room join was replaced by a newer request.'))

    const pending = { roomId, resolve: null, reject: null, promise: null, timer: null }
    pending.promise = new Promise((resolve, reject) => {
      pending.resolve = resolve
      pending.reject = reject
    })
    pending.timer = setTimeout(() => {
      if (pendingJoin === pending) {
        settlePendingJoin(new Error('The room took too long to open.'))
      }
    }, 15_000)
    pendingJoin = pending
    if (!socket.connected) socket.connect()
    else joinRoom()
    return pending.promise
  },
  reconnect() {
    if (!joinedRoom) return Promise.reject(new Error('No room to reconnect to.'))
    const roomId = joinedRoom
    joinAck = null
    if (socket?.connected) socket.disconnect()
    return this.connect(roomId)
  },
  disconnect() {
    settlePendingJoin(new Error('Connection closed before the room opened.'))
    joinedRoom = null
    selfId = null
    joinAck = null
    hadConnection = false
    TICK_SAMPLES.clear()
    if (socket) socket.disconnect()
    dispatch('connection:closed', { reason: 'manual' })
  },
  on,
  emit(event, payload) {
    socket?.emit(event, payload)
  },
  emitWithAck(event, payload) {
    return new Promise((resolve) => {
      if (!socket?.connected) {
        resolve({ ok: false, error: 'Not connected.' })
        return
      }
      socket.timeout(6000).emit(event, payload, (error, response) => {
        if (error) resolve({ ok: false, error: 'The island did not answer.' })
        else resolve(response ?? { ok: false, error: 'No answer.' })
      })
    })
  },
  get selfId() {
    return selfId
  },
  get roomId() {
    return joinedRoom
  },
  get connected() {
    return Boolean(socket?.connected)
  },
  get lastError() {
    return lastError
  },
  getSamples(id) {
    return TICK_SAMPLES.get(id) ?? []
  },
  clear() {
    TICK_SAMPLES.clear()
  },
}
