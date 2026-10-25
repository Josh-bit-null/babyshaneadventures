import http from 'node:http'
import { Server as SocketServer } from 'socket.io'
import { createApp } from './app.js'
import { buildConfig, setRuntimeConfig } from './config.js'
import { closeDatabase, initDatabase } from './db.js'
import { attachRealtime } from './realtime/rooms.js'
import { seedDemoUsers } from './seed.js'

function socketOriginChecker(config) {
  const allowed = new Set([...config.clientOrigins, config.publicOrigin].filter(Boolean))
  return (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowed.has(origin)) return callback(null, true)
    if (!config.production) {
      try {
        const { hostname } = new URL(origin)
        if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
          return callback(null, true)
        }
      } catch {
        /* fall through */
      }
    }
    return callback(new Error('Origin not allowed'))
  }
}

export async function createServer(overrides = {}) {
  const config = buildConfig(overrides)
  setRuntimeConfig(config)
  await initDatabase(config)
  const seeded = await seedDemoUsers(config)

  const app = createApp(config)
  const httpServer = http.createServer(app)
  const io = new SocketServer(httpServer, {
    path: config.socketPath,
    cors: {
      origin: socketOriginChecker(config),
      credentials: true,
    },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1_000_000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 20_000,
    },
  })

  const realtime = attachRealtime(io, config)

  let closed = false
  async function close() {
    if (closed) return
    closed = true
    realtime.stop()
    await new Promise((resolve) => io.close(resolve))
    if (httpServer.listening) {
      await new Promise((resolve) => httpServer.close(resolve))
    }
    await closeDatabase()
  }

  return { app, httpServer, io, config, seeded, close, realtime }
}

export async function listen(overrides = {}) {
  const server = await createServer(overrides)
  await new Promise((resolve, reject) => {
    server.httpServer.once('error', reject)
    server.httpServer.listen(server.config.port, () => {
      server.httpServer.off('error', reject)
      resolve()
    })
  })
  return server
}
