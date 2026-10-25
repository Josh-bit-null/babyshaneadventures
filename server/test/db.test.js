import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDatabaseUrl } from '../src/db.js'

test('parses MariaDB URLs into supported pool options', () => {
  assert.deepEqual(
    parseDatabaseUrl('mariadb://study%40pair:p%3Ass@db.example:3307/babyshane?ssl=true'),
    {
      host: 'db.example',
      port: 3307,
      user: 'study@pair',
      password: 'p:ss',
      database: 'babyshane',
      ssl: { rejectUnauthorized: true },
    },
  )
})

test('rejects malformed or non-MySQL database URLs', () => {
  assert.throws(() => parseDatabaseUrl('not-a-url'), /valid MariaDB\/MySQL/)
  assert.throws(() => parseDatabaseUrl('postgres://user:pass@host/db'), /mysql:\/\/ or mariadb:\/\//)
  assert.throws(() => parseDatabaseUrl('mysql://user:pass@host'), /database name/)
})
