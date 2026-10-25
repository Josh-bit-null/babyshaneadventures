import { listen } from './server.js'
import { databaseStatus } from './db.js'

const server = await listen()

const { socketPath, tickRate, production, clientOrigins } = server.config
const port = server.httpServer.address()?.port ?? server.config.port
const banner = `
  🍄  BabyShaneAdventures API
  ─────────────────────────────────────────
  http://localhost:${port}
  Socket.IO path: ${socketPath}  ·  ${tickRate} ticks/sec
  Mode: ${production ? 'production' : 'development'}
  Allowed origins: ${clientOrigins.join(', ')}
  DB: ${databaseStatus().dialect || 'connecting'}
  Demo accounts: ${server.seeded.length ? server.seeded.map((u) => `${u.username}/${u.pin}`).join(', ') : 'already seeded'}
`
console.log(banner)

async function shutdown(signal) {
  console.log(`\n[server] ${signal} received, closing…`)
  try {
    await server.close()
    process.exit(0)
  } catch (error) {
    console.error('[server] shutdown failed:', error)
    process.exit(1)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
