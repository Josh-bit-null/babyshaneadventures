import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from '../src/server.js'

test('starts with SQLite and serves authenticated room state', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'babyshane-test-'))
  let server
  try {
    server = await createServer({
      databaseUrl: '',
      sqlitePath: path.join(directory, 'test.sqlite'),
      seedDemo: false,
      nodeEnv: 'test',
      jwtSecret: 'server-test-secret',
      clientOrigin: 'http://localhost:5173',
      publicOrigin: '',
      port: 0,
    })
    await new Promise((resolve, reject) => {
      server.httpServer.once('error', reject)
      server.httpServer.listen(0, '127.0.0.1', resolve)
    })

    const address = server.httpServer.address()
    const origin = `http://127.0.0.1:${address.port}`
    const health = await fetch(`${origin}/api/health`)
    assert.equal(health.status, 200)
    assert.equal((await health.json()).database.dialect, 'sqlite')

    const registration = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'test_explorer',
        pin: '2468',
        displayName: 'Test Explorer',
      }),
    })
    assert.equal(registration.status, 201)
    const cookie = registration.headers.get('set-cookie')?.split(';', 1)[0]
    assert.ok(cookie)

    const room = await fetch(`${origin}/api/world/test-room`, {
      headers: { cookie },
    })
    assert.equal(room.status, 200)
    const snapshot = await room.json()
    assert.equal(snapshot.room.id, 'test-room')
    assert.ok(Array.isArray(snapshot.inventory))
    assert.ok(Array.isArray(snapshot.catalog.items))
  } finally {
    if (server) await server.close()
    await rm(directory, { recursive: true, force: true })
  }
})
