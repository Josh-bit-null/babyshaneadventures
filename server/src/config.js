import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
export const SERVER_ROOT = path.resolve(here, '..')
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..')

// Root .env is shared by Vite (envDir: '..') and the server. server/.env can
// override it for server-only secrets if desired.
dotenv.config({ path: path.join(REPO_ROOT, '.env') })
dotenv.config({ path: path.join(SERVER_ROOT, '.env'), override: true })

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

const bool = (value, fallback = false) => {
  if (value == null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

const list = (value, fallback) =>
  String(value || fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

let runtimeConfig = null

export function setRuntimeConfig(config) {
  runtimeConfig = config
}

/** Runtime config after createServer(); auth helpers rely on this. */
export function getConfig() {
  return runtimeConfig ?? buildConfig()
}

export function buildConfig(overrides = {}) {
  const nodeEnv = overrides.nodeEnv ?? process.env.NODE_ENV ?? 'development'
  const production = nodeEnv === 'production'
  const jwtSecret =
    overrides.jwtSecret ||
    process.env.JWT_SECRET ||
    (production ? '' : 'babyshane-dev-secret-change-me')

  if (!jwtSecret && production) {
    throw new Error('JWT_SECRET is required in production.')
  }

  const databaseUrl = overrides.databaseUrl ?? process.env.DATABASE_URL ?? ''
  const sqlitePath = path.resolve(
    REPO_ROOT,
    overrides.sqlitePath ?? process.env.SQLITE_PATH ?? 'server/data/babyshane.sqlite',
  )

  return {
    nodeEnv,
    production,
    port: overrides.port ?? int(process.env.PORT, 3001),
    clientOrigins: list(
      overrides.clientOrigin ?? process.env.CLIENT_ORIGIN,
      'http://localhost:5173',
    ),
    publicOrigin: (overrides.publicOrigin ?? process.env.PUBLIC_ORIGIN ?? '').replace(/\/$/, ''),
    socketPath: overrides.socketPath ?? process.env.SOCKET_PATH ?? '/socket.io',
    tickRate: Math.min(30, Math.max(10, overrides.tickRate ?? int(process.env.TICK_RATE, 20))),
    jwtSecret,
    jwtTtl: overrides.jwtTtl ?? process.env.JWT_TTL ?? '7d',
    cookieName: overrides.cookieName ?? process.env.COOKIE_NAME ?? 'bsa_token',
    cookieSecure: overrides.cookieSecure ?? bool(process.env.COOKIE_SECURE, production),
    databaseUrl,
    db: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: int(process.env.DB_PORT, 3306),
      user: process.env.DB_USER || 'bsa',
      password: process.env.DB_PASSWORD || 'bsa',
      database: process.env.DB_NAME || 'babyshane',
      connectionLimit: int(process.env.DB_POOL_SIZE, 10),
    },
    sqlitePath,
    geminiKey: overrides.geminiKey ?? process.env.GEMINI_API_KEY ?? '',
    geminiModel: overrides.geminiModel ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    seedDemo: overrides.seedDemo ?? bool(process.env.SEED_DEMO, !production),
    demoPin: process.env.DEMO_PIN || '1234',
    clientDist: path.join(REPO_ROOT, 'client', 'dist'),
    maxAssetBytes: int(process.env.VITE_MAX_ASSET_BYTES, 18_000_000),
  }
}
