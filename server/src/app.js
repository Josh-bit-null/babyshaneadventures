import fs from 'node:fs'
import path from 'node:path'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import { authRouter } from './routes/auth.js'
import { studyRouter } from './routes/study.js'
import { worldRouter } from './routes/world.js'
import { databaseStatus } from './db.js'

export function createApp(config) {
  const app = express()
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  const allowedOrigins = new Set(
    [...config.clientOrigins, config.publicOrigin].filter(Boolean),
  )

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()')
    next()
  })

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin) return callback(null, true)
        if (allowedOrigins.has(origin)) return callback(null, true)
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
        const error = new Error('Origin not allowed')
        error.status = 403
        return callback(error)
      },
    }),
  )
  app.use(compression())
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'babyshaneadventures',
      database: databaseStatus(),
      tickRate: config.tickRate,
      quizProvider: config.geminiKey ? 'gemini' : 'offline',
    })
  })

  app.use('/api/auth', authRouter)
  app.use('/api', worldRouter)
  app.use('/api', studyRouter)

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'No such API route.' })
  })

  // Production: the Express server serves the client build. Also enabled in
  // local previews when client/dist exists, so `NODE_ENV=production npm start`
  // works exactly like the deployment.
  const indexHtml = path.join(config.clientDist, 'index.html')
  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(config.clientDist, {
        maxAge: config.production ? '1y' : 0,
        immutable: config.production,
        setHeaders(res, filePath) {
          if (
            filePath.endsWith('sw.js') ||
            filePath.endsWith('manifest.webmanifest') ||
            filePath.endsWith('index.html')
          ) {
            res.setHeader('Cache-Control', 'no-cache')
          }
        },
      }),
    )
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next()
      if (!req.accepts('html')) return next()
      res.sendFile(indexHtml)
    })
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found.' })
  })

  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'That upload is too large.' })
      return
    }
    if (error?.status === 403) {
      res.status(403).json({ error: 'This origin is not allowed.' })
      return
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: 'Malformed JSON body.' })
      return
    }
    console.error('[api] unhandled:', error)
    res.status(500).json({ error: 'Something went wrong on the island.' })
  })

  return app
}
