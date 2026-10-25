export const ROOM_ID_RE = /^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/
export const DEFAULT_ROOM = 'sunny-hideaway'

export function sanitizeRoomId(value) {
  const roomId = String(value ?? DEFAULT_ROOM)
    .toLowerCase()
    .trim()
  return ROOM_ID_RE.test(roomId) ? roomId : null
}

export const finite = (value) => typeof value === 'number' && Number.isFinite(value)

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function sanitizeText(value, max = 120) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
}

export function sanitizeTransform(input) {
  if (!input || typeof input !== 'object') return null
  const num = (value, min, max) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return null
    return Number(clamp(n, min, max).toFixed(3))
  }
  const x = num(input.x, -20, 20)
  const y = num(input.y, 0, 6)
  const z = num(input.z, -20, 20)
  if (x == null || y == null || z == null) return null
  return {
    x,
    y,
    z,
    rx: num(input.rx ?? 0, -Math.PI, Math.PI) ?? 0,
    ry: num(input.ry ?? 0, -Math.PI * 2, Math.PI * 2) ?? 0,
    rz: num(input.rz ?? 0, -Math.PI, Math.PI) ?? 0,
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
