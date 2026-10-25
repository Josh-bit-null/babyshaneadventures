import { hashPin } from './auth.js'
import { defaultAvatar } from './content/avatars.js'
import { createUser, findUserByUsername } from './repo.js'

const DEMO_USERS = [
  {
    username: 'joshua',
    displayName: 'Mushroom Joshua',
    persona: 'mushroom',
  },
  {
    username: 'rika',
    displayName: 'Siopao RikaShane',
    persona: 'siopao',
  },
]

export async function seedDemoUsers(config) {
  if (!config.seedDemo) return []
  const created = []
  for (const demo of DEMO_USERS) {
    const existing = await findUserByUsername(demo.username)
    if (existing) continue
    try {
      const row = await createUser({
        username: demo.username,
        displayName: demo.displayName,
        pinHash: hashPin(config.demoPin),
        avatar: defaultAvatar(demo.persona),
        coins: 1200,
      })
      created.push({ username: demo.username, pin: config.demoPin, id: row.id })
    } catch (error) {
      // A concurrent seed or a user registering the same name is harmless.
      if (!/unique|duplicate/i.test(error.message)) throw error
    }
  }
  return created
}
