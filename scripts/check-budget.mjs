import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const maxBytes = Number(process.env.VITE_MAX_ASSET_BYTES || 18_000_000)
const roots = [
  path.join(root, 'client', 'dist'),
  path.join(root, 'client', 'public', 'models'),
  path.join(root, 'client', 'public', 'fonts'),
  path.join(root, 'client', 'public', 'tessdata'),
]

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (!entry.name.endsWith('.map')) files.push({ full, size: fs.statSync(full).size })
  }
  return files
}

const seen = new Set()
const files = []
for (const dir of roots) {
  for (const file of walk(dir)) {
    if (seen.has(file.full)) continue
    seen.add(file.full)
    files.push(file)
  }
}

const total = files.reduce((sum, file) => sum + file.size, 0)
const mb = (bytes) => `${(bytes / 1_000_000).toFixed(2)} MB`
const fmt = mb(total)

console.log(`\nPayload budget`)
console.log(`  files: ${files.length}`)
console.log(`  total: ${fmt} / ${mb(maxBytes)} (${((total / maxBytes) * 100).toFixed(1)}%)`)

const groups = new Map()
for (const file of files) {
  const rel = path.relative(root, file.full).split(path.sep)[0]
  groups.set(rel, (groups.get(rel) || 0) + file.size)
}
for (const [group, size] of [...groups].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${group.padEnd(14)} ${mb(size)}`)
}

if (total > maxBytes) {
  console.error(`\n✖ Payload exceeds ${mb(maxBytes)}. Remove assets before shipping.`)
  process.exit(1)
}
console.log('✓ Under the 18 MB multiplayer payload ceiling.\n')
