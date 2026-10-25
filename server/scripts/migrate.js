import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { buildConfig, REPO_ROOT, SERVER_ROOT } from '../src/config.js'
import { initDatabase, closeDatabase, databaseStatus } from '../src/db.js'

const config = buildConfig()

if (!config.databaseUrl) {
  console.log('No DATABASE_URL configured.')
  console.log('Local mode uses Node SQLite and creates its schema automatically at:')
  console.log(`  ${path.relative(REPO_ROOT, config.sqlitePath)}`)
  await initDatabase(config)
  console.log(`SQLite ready (${databaseStatus().dialect}).`)
  await closeDatabase()
  process.exit(0)
}

const schema = fs.readFileSync(path.join(SERVER_ROOT, 'db', 'schema.mariadb.sql'), 'utf8')
const pool = mysql.createPool({
  uri: config.databaseUrl,
  multipleStatements: true,
  charset: 'utf8mb4',
})

try {
  await pool.query(schema)
  const [tables] = await pool.query('SHOW TABLES')
  console.log('MariaDB schema applied. Tables:')
  for (const row of tables) console.log('  •', Object.values(row)[0])
} catch (error) {
  console.error('Migration failed:', error.message)
  console.error('Check DATABASE_URL, the database user privileges, and that MariaDB is running.')
  process.exitCode = 1
} finally {
  await pool.end()
}
