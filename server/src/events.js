import { EventEmitter } from 'node:events'

/**
 * REST routes and the Socket.IO layer are deliberately decoupled: a route
 * writes to MariaDB, then emits `world:changed`; the realtime layer fetches the
 * fresh room snapshot and broadcasts it to everyone standing in that room.
 */
export const roomEvents = new EventEmitter()
roomEvents.setMaxListeners(50)
