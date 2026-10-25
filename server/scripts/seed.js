import { buildConfig, setRuntimeConfig } from '../src/config.js'
import { closeDatabase, initDatabase } from '../src/db.js'
import { ensureRoom } from '../src/repo.js'
import { seedDemoUsers } from '../src/seed.js'

const config = buildConfig()
config.seedDemo = true
setRuntimeConfig(config)
await initDatabase(config)

const created = await seedDemoUsers(config)
await ensureRoom('sunny-hideaway')

console.log('Seeded demo pair:')
if (created.length === 0) {
  console.log('  (accounts already existed)')
}
for (const user of created) {
  console.log(`  • ${user.username} / ${user.pin}`)
}
console.log('Default room: sunny-hideaway')

await closeDatabase()
