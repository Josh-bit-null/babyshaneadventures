import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import mysql from 'mysql2/promise'
import { SERVER_ROOT } from './config.js'

/**
 * BabyShane persistence.
 *
 * MariaDB is the primary store and is used whenever DATABASE_URL is present.
 * Local development falls back to Node's built-in SQLite so the app is fully
 * functional with zero external services. Both dialects create the same three
 * tables and share every query below (positional `?` placeholders only).
 */

let driver = null
let pool = null
let sqlite = null
let dialect = null

const parseJson = (value, fallback) => {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export const db = {
  get dialect() {
    return dialect
  },
  parseJson,
}

export function parseDatabaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('DATABASE_URL must be a valid MariaDB/MySQL connection URL.')
  }

  if (!['mysql:', 'mariadb:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use the mysql:// or mariadb:// scheme.')
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
  const user = decodeURIComponent(url.username)
  if (!url.hostname || !database || !user) {
    throw new Error('DATABASE_URL must include a host, username and database name.')
  }

  const sslMode = url.searchParams.get('ssl-mode')?.toUpperCase()
  const sslEnabled = ['1', 'true', 'required', 'verify_ca', 'verify_identity'].includes(
    url.searchParams.get('ssl')?.toLowerCase() || sslMode?.toLowerCase(),
  )

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user,
    password: decodeURIComponent(url.password),
    database,
    ...(sslEnabled ? { ssl: { rejectUnauthorized: true } } : {}),
  }
}

function makeSqliteTx() {
  return {
    all: async (sql, params = []) => sqlite.prepare(sql).all(...params),
    one: async (sql, params = []) => sqlite.prepare(sql).get(...params) ?? null,
    run: async (sql, params = []) => {
      const info = sqlite.prepare(sql).run(...params)
      return { changes: Number(info.changes), insertId: Number(info.lastInsertRowid) }
    },
  }
}

function makeMysqlTx(connection) {
  return {
    all: async (sql, params = []) => {
      const [rows] = await connection.query(sql, params)
      return rows
    },
    one: async (sql, params = []) => {
      const [rows] = await connection.query(sql, params)
      return rows[0] ?? null
    },
    run: async (sql, params = []) => {
      const [result] = await connection.query(sql, params)
      return { changes: result.affectedRows, insertId: result.insertId }
    },
  }
}

export async function initDatabase(config) {
  if (driver) return db

  if (config.databaseUrl) {
    dialect = 'mariadb'
    driver = 'mariadb'
    const schema = fs.readFileSync(
      path.join(SERVER_ROOT, 'db', 'schema.mariadb.sql'),
      'utf8',
    )
    pool = mysql.createPool({
      ...parseDatabaseUrl(config.databaseUrl),
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit,
      multipleStatements: true,
      charset: 'utf8mb4',
      timezone: 'Z',
    })
    await pool.query(schema)
  } else {
    dialect = 'sqlite'
    driver = 'sqlite'
    fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true })
    sqlite = new DatabaseSync(config.sqlitePath)
    sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
    sqlite.exec(fs.readFileSync(path.join(SERVER_ROOT, 'db', 'schema.sqlite.sql'), 'utf8'))
  }

  return db
}

export async function closeDatabase() {
  if (pool) await pool.end()
  if (sqlite?.isOpen) sqlite.close()
  pool = null
  sqlite = null
  driver = null
  dialect = null
}

export async function all(sql, params = []) {
  if (dialect === 'mariadb') {
    const [rows] = await pool.query(sql, params)
    return rows
  }
  return sqlite.prepare(sql).all(...params)
}

export async function one(sql, params = []) {
  if (dialect === 'mariadb') {
    const [rows] = await pool.query(sql, params)
    return rows[0] ?? null
  }
  return sqlite.prepare(sql).get(...params) ?? null
}

export async function run(sql, params = []) {
  if (dialect === 'mariadb') {
    const [result] = await pool.query(sql, params)
    return { changes: result.affectedRows, insertId: result.insertId }
  }
  const info = sqlite.prepare(sql).run(...params)
  return { changes: Number(info.changes), insertId: Number(info.lastInsertRowid) }
}

export async function transaction(fn) {
  if (dialect === 'mariadb') {
    const connection = await pool.getConnection()
    const tx = makeMysqlTx(connection)
    await connection.beginTransaction()
    try {
      const result = await fn(tx)
      await connection.commit()
      return result
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  sqlite.exec('BEGIN IMMEDIATE')
  try {
    const result = await fn(makeSqliteTx())
    sqlite.exec('COMMIT')
    return result
  } catch (error) {
    sqlite.exec('ROLLBACK')
    throw error
  }
}

/** Used by tests to inject a different database file between runs. */
export function databaseStatus() {
  return { dialect, connected: Boolean(pool || sqlite) }
}
