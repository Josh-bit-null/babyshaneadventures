import crypto from 'node:crypto'
import { all, db, one, run, transaction } from './db.js'
import { CHORES } from './content/chores.js'
import {
  CATALOG_BY_SKU,
  DECK_TOP,
  DEFAULT_THEME,
  STARTER_ITEMS,
  slotForIndex,
} from './content/catalog.js'

const nowIso = () => new Date().toISOString()
const asInt = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export function defaultWorldState() {
  return {
    chores: CHORES.map((chore) => ({
      ...chore,
      status: 'open',
      claimedBy: null,
      claimedByName: null,
      verifiedBy: null,
      verifiedByName: null,
      completedAt: null,
    })),
    pomodoro: {
      status: 'idle',
      durationMs: 25 * 60_000,
      endsAt: null,
      startedAt: null,
      startedBy: null,
      startedByName: null,
      sessionId: null,
      plantHealth: 1,
      failedBy: null,
      failedByName: null,
      completedAt: null,
    },
    screenTime: {
      roundId: crypto.randomUUID(),
      submissions: {},
      result: null,
    },
  }
}

export function normalizeWorldState(value) {
  const defaults = defaultWorldState()
  const stored = typeof value === 'string' ? db.parseJson(value, null) : value
  if (!stored || typeof stored !== 'object') return defaults

  const storedChores = new Map(
    (Array.isArray(stored.chores) ? stored.chores : []).map((chore) => [chore.id, chore]),
  )
  const chores = defaults.chores.map((chore) => ({
    ...chore,
    ...(storedChores.get(chore.id) ?? {}),
    rewardSku: chore.rewardSku,
    label: chore.label,
    blurb: chore.blurb,
    icon: chore.icon,
  }))

  return {
    ...defaults,
    ...stored,
    chores,
    pomodoro: { ...defaults.pomodoro, ...(stored.pomodoro ?? {}) },
    screenTime: {
      ...defaults.screenTime,
      ...(stored.screenTime ?? {}),
      submissions: { ...(stored.screenTime?.submissions ?? {}) },
    },
  }
}

export function publicUser(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    coins: asInt(row.coins),
    rpmAvatarUrl: row.rpm_avatar_url ?? null,
    avatarConfig: db.parseJson(row.avatar_config, null),
    createdAt: row.created_at,
  }
}

export function publicRoom(row) {
  if (!row) return null
  return {
    id: row.id,
    theme: row.theme || DEFAULT_THEME,
    worldState: normalizeWorldState(row.world_state),
    socketInstanceIds: db.parseJson(row.socket_instance_ids, []),
  }
}

const starterItems = () =>
  STARTER_ITEMS.map((item, index) => {
    const catalogItem = CATALOG_BY_SKU.get(item.sku)
    return {
      uid: `starter-${item.sku}-${index}`,
      sku: item.sku,
      x: item.x,
      y: item.y,
      z: item.z,
      rx: 0,
      ry: item.ry ?? 0,
      rz: 0,
      scale: catalogItem?.scale ?? 1,
      source: 'starter',
    }
  })

export async function ensureRoom(roomId) {
  let row = await one('SELECT * FROM Rooms WHERE id = ?', [roomId])
  if (!row) {
    try {
      await run(
        'INSERT INTO Rooms (id, socket_instance_ids, theme, world_state) VALUES (?, ?, ?, ?)',
        [roomId, JSON.stringify([]), DEFAULT_THEME, JSON.stringify(defaultWorldState())],
      )
    } catch {
      // Another process created it between SELECT and INSERT.
    }
    row = await one('SELECT * FROM Rooms WHERE id = ?', [roomId])
  }

  const shared = await one(
    'SELECT * FROM Inventories WHERE room_id = ? AND user_id = 0',
    [roomId],
  )
  if (!shared) {
    try {
      await run(
        'INSERT INTO Inventories (room_id, user_id, items) VALUES (?, ?, ?)',
        [roomId, 0, JSON.stringify(starterItems())],
      )
    } catch {
      // Already seeded concurrently.
    }
  }

  return publicRoom(row)
}

export async function getRoom(roomId) {
  const row = await one('SELECT * FROM Rooms WHERE id = ?', [roomId])
  return publicRoom(row)
}

export async function getRoomRow(roomId) {
  return one('SELECT * FROM Rooms WHERE id = ?', [roomId])
}

export async function setRoomWorldState(roomId, worldState) {
  await run('UPDATE Rooms SET world_state = ? WHERE id = ?', [
    JSON.stringify(worldState),
    roomId,
  ])
}

export async function setRoomTheme(roomId, themeSku) {
  await run('UPDATE Rooms SET theme = ? WHERE id = ?', [themeSku, roomId])
}

export async function setRoomSockets(roomId, socketIds) {
  await run('UPDATE Rooms SET socket_instance_ids = ? WHERE id = ?', [
    JSON.stringify(socketIds),
    roomId,
  ])
}

export async function findUserByUsername(username) {
  return one('SELECT * FROM Users WHERE username = ?', [username])
}

export async function findUserById(id) {
  return one('SELECT * FROM Users WHERE id = ?', [id])
}

export async function createUser({ username, displayName, pinHash, avatar, coins = 350 }) {
  const result = await run(
    `INSERT INTO Users (username, display_name, pin_hash, avatar_config, coins)
     VALUES (?, ?, ?, ?, ?)`,
    [username, displayName, pinHash, JSON.stringify(avatar), coins],
  )
  return findUserById(result.insertId)
}

export async function updateUserAvatar(userId, { avatarConfig, rpmAvatarUrl }) {
  await run(
    'UPDATE Users SET rpm_avatar_url = ?, avatar_config = ? WHERE id = ?',
    [rpmAvatarUrl ?? null, JSON.stringify(avatarConfig), userId],
  )
  return findUserById(userId)
}

/** The exact UPDATE the spec asks for when awarding coins. */
export async function addCoins(userId, amount) {
  await run('UPDATE Users SET coins = coins + ? WHERE id = ?', [asInt(amount), userId])
  return findUserById(userId)
}

export async function spendCoins(userId, amount) {
  const result = await run(
    'UPDATE Users SET coins = coins - ? WHERE id = ? AND coins >= ?',
    [asInt(amount), userId, asInt(amount)],
  )
  return result.changes === 1
}

export async function setUserCoins(userId, coins) {
  await run('UPDATE Users SET coins = ? WHERE id = ?', [asInt(coins), userId])
}

export async function getInventoryRow(roomId, userId, client = null) {
  const query = client?.one ?? one
  return query('SELECT * FROM Inventories WHERE room_id = ? AND user_id = ?', [roomId, userId])
}

export function itemsOf(row) {
  return db.parseJson(row?.items, [])
}

export async function getRoomInventories(roomId) {
  const rows = await all('SELECT * FROM Inventories WHERE room_id = ? ORDER BY user_id ASC', [
    roomId,
  ])
  return rows.map((row) => ({
    userId: Number(row.user_id),
    items: itemsOf(row),
    updatedAt: row.updated_at,
  }))
}

/**
 * The whole room is rendered by both players. Each item carries ownerId so the
 * client can distinguish "mine" (ownerId === userId), shared (0) and partner
 * furniture before rendering the exact transform.
 */
export async function inventoryForRoom(roomId, userId) {
  const [rows, room] = await Promise.all([getRoomInventories(roomId), getRoom(roomId)])
  const items = rows.flatMap((row) =>
    row.items.map((item) => ({ ...item, ownerId: row.userId })),
  )
  return {
    items,
    mine: items.filter((item) => item.ownerId === userId),
    shared: items.filter((item) => item.ownerId === 0),
    theme: room?.theme ?? DEFAULT_THEME,
    worldState: room?.worldState ?? normalizeWorldState(null),
  }
}

export async function ensureInventory(roomId, userId) {
  const existing = await getInventoryRow(roomId, userId)
  if (existing) return existing
  try {
    await run('INSERT INTO Inventories (room_id, user_id, items) VALUES (?, ?, ?)', [
      roomId,
      userId,
      JSON.stringify([]),
    ])
  } catch {
    // concurrent insert
  }
  return getInventoryRow(roomId, userId)
}

function makeItem(sku, { x, y, z, rx = 0, ry = 0, rz = 0, scale, source = 'purchase' }) {
  const catalogItem = CATALOG_BY_SKU.get(sku)
  if (!catalogItem) throw new Error(`Unknown sku: ${sku}`)
  return {
    uid: crypto.randomUUID(),
    sku,
    x,
    y,
    z,
    rx,
    ry,
    rz,
    scale: scale ?? catalogItem.scale ?? 1,
    source,
    placedAt: nowIso(),
  }
}

/** Buy a catalog item, deducting coins and writing its transform in one transaction. */
export async function purchaseItem({ roomId, userId, sku }) {
  const catalogItem = CATALOG_BY_SKU.get(sku)
  if (!catalogItem) {
    const error = new Error('That item is not in the catalog.')
    error.status = 404
    throw error
  }
  if (catalogItem.earnOnly) {
    const error = new Error('Rare drops can only be earned by completing chores.')
    error.status = 403
    throw error
  }

  return transaction(async (tx) => {
    const user = await tx.one('SELECT * FROM Users WHERE id = ?', [userId])
    if (!user) {
      const error = new Error('User not found.')
      error.status = 401
      throw error
    }

    const ownRow = await tx.one(
      'SELECT * FROM Inventories WHERE room_id = ? AND user_id = ?',
      [roomId, userId],
    )
    const ownItems = db.parseJson(ownRow?.items, [])
    const sharedRow = await tx.one(
      'SELECT * FROM Inventories WHERE room_id = ? AND user_id = 0',
      [roomId],
    )
    const sharedItems = db.parseJson(sharedRow?.items, [])

    if (catalogItem.kind === 'theme' && ownItems.some((item) => item.sku === sku)) {
      const error = new Error('You already own this theme.')
      error.status = 409
      throw error
    }

    if (Number(user.coins) < catalogItem.price) {
      const error = new Error('Not enough coins yet.')
      error.status = 402
      error.code = 'INSUFFICIENT_COINS'
      throw error
    }

    if (catalogItem.price > 0) {
      const paid = await tx.run(
        'UPDATE Users SET coins = coins - ? WHERE id = ? AND coins >= ?',
        [catalogItem.price, userId, catalogItem.price],
      )
      if (paid.changes !== 1) {
        const error = new Error('Not enough coins yet.')
        error.status = 402
        error.code = 'INSUFFICIENT_COINS'
        throw error
      }
    }

    let item = null
    if (catalogItem.kind === 'theme') {
      item = {
        uid: crypto.randomUUID(),
        sku,
        source: 'purchase',
        placedAt: nowIso(),
      }
    } else {
      const slot = slotForIndex(ownItems.length + sharedItems.length)
      item = makeItem(sku, { ...slot, source: 'purchase' })
    }

    const nextItems = [...ownItems, item]
    if (ownRow) {
      await tx.run('UPDATE Inventories SET items = ? WHERE id = ?', [
        JSON.stringify(nextItems),
        ownRow.id,
      ])
    } else {
      await tx.run('INSERT INTO Inventories (room_id, user_id, items) VALUES (?, ?, ?)', [
        roomId,
        userId,
        JSON.stringify(nextItems),
      ])
    }

    if (catalogItem.kind === 'theme') {
      await tx.run('UPDATE Rooms SET theme = ? WHERE id = ?', [sku, roomId])
    }

    const updatedUser = await tx.one('SELECT * FROM Users WHERE id = ?', [userId])
    return { item, user: publicUser(updatedUser), theme: catalogItem.kind === 'theme' ? sku : null }
  })
}

export async function addItemToInventory({ roomId, userId, sku, source, transform }) {
  return transaction(async (tx) => {
    const row = await tx.one(
      'SELECT * FROM Inventories WHERE room_id = ? AND user_id = ?',
      [roomId, userId],
    )
    const items = db.parseJson(row?.items, [])
    const slot = transform ?? slotForIndex(items.length)
    const item = makeItem(sku, {
      x: slot.x,
      y: slot.y ?? DECK_TOP,
      z: slot.z,
      rx: slot.rx,
      ry: slot.ry,
      rz: slot.rz,
      scale: slot.scale,
      source,
    })
    const next = [...items, item]
    if (row) {
      await tx.run('UPDATE Inventories SET items = ? WHERE id = ?', [
        JSON.stringify(next),
        row.id,
      ])
    } else {
      await tx.run('INSERT INTO Inventories (room_id, user_id, items) VALUES (?, ?, ?)', [
        roomId,
        userId,
        JSON.stringify(next),
      ])
    }
    return item
  })
}

export async function updateItemTransform({ roomId, userId, itemUid, transform }) {
  return transaction(async (tx) => {
    const own = await tx.one(
      'SELECT * FROM Inventories WHERE room_id = ? AND user_id = ?',
      [roomId, userId],
    )
    const shared = await tx.one(
      'SELECT * FROM Inventories WHERE room_id = ? AND user_id = 0',
      [roomId],
    )
    const targets = [
      { row: own, owner: userId },
      { row: shared, owner: 0 },
    ]
    for (const { row, owner } of targets) {
      if (!row) continue
      const items = db.parseJson(row.items, [])
      const index = items.findIndex((item) => item.uid === itemUid)
      if (index === -1) continue
      items[index] = {
        ...items[index],
        x: transform.x,
        y: transform.y,
        z: transform.z,
        rx: transform.rx ?? items[index].rx ?? 0,
        ry: transform.ry ?? items[index].ry ?? 0,
        rz: transform.rz ?? items[index].rz ?? 0,
      }
      await tx.run('UPDATE Inventories SET items = ? WHERE id = ?', [
        JSON.stringify(items),
        row.id,
      ])
      return { item: items[index], owner }
    }
    const error = new Error('That item was not found in this room.')
    error.status = 404
    throw error
  })
}

/** Persist a screen-time submission into the room's JSON world state. */
export async function writeScreenTimeSubmission({ roomId, userId, userName, minutes }) {
  return transaction(async (tx) => {
    const lock = db.dialect === 'mariadb' ? ' FOR UPDATE' : ''
    const row = await tx.one(`SELECT * FROM Rooms WHERE id = ?${lock}`, [roomId])
    if (!row) throw new Error('Room not found')
    const world = normalizeWorldState(row.world_state)

    // A submission after a resolved duel starts a fresh round.
    if (world.screenTime.result) {
      world.screenTime = {
        roundId: crypto.randomUUID(),
        submissions: {},
        result: null,
      }
    }
    world.screenTime.submissions[String(userId)] = {
      userId,
      name: userName,
      minutes,
      at: nowIso(),
    }

    const entries = Object.values(world.screenTime.submissions)
    let awarded = null
    if (entries.length >= 2) {
      const sorted = [...entries].sort((a, b) => a.minutes - b.minutes)
      const [low, high] = sorted
      const tie = low.minutes === high.minutes
      if (!tie) {
        await tx.run('UPDATE Users SET coins = coins + ? WHERE id = ?', [500, low.userId])
      }
      awarded = {
        amount: tie ? 0 : 500,
        tie,
        winnerId: tie ? null : low.userId,
        winnerName: tie ? null : low.name,
        loserId: tie ? null : high.userId,
        loserName: tie ? null : high.name,
        minutes: Object.fromEntries(entries.map((entry) => [entry.userId, entry.minutes])),
        resolvedAt: nowIso(),
      }
      world.screenTime.result = awarded
    }

    await tx.run('UPDATE Rooms SET world_state = ? WHERE id = ?', [
      JSON.stringify(world),
      roomId,
    ])

    return { screenTime: world.screenTime, awarded }
  })
}

export async function saveWorld(roomId, worldState) {
  await setRoomWorldState(roomId, worldState)
  return worldState
}

export const roomRepo = {
  ensureRoom,
  getRoom,
  getRoomRow,
  setRoomSockets,
  setRoomTheme,
  setRoomWorldState,
  getRoomInventories,
  inventoryForRoom,
  purchaseItem,
  addItemToInventory,
  updateItemTransform,
  writeScreenTimeSubmission,
  saveWorld,
}

export const userRepo = {
  findUserByUsername,
  findUserById,
  createUser,
  updateUserAvatar,
  addCoins,
  spendCoins,
  setUserCoins,
  publicUser,
}
