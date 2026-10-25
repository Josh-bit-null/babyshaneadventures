/**
 * Spatial audio gain is derived from the exact 3D vector between avatars:
 *
 *   d = sqrt(dx² + dy² + dz²)
 *   gain = clamp(1 - (d - NEAR) / (FAR - NEAR), 0, 1) ** 1.6
 *
 * Inside ~14.5 m you can hear each other; farther away the stream is muted.
 */
export const NEAR_DISTANCE = 1.6
export const FAR_DISTANCE = 14.5

const audioElements = new Map()
const peerPositions = new Map()
let localPosition = [0, 0, 0]

export function setLocalAudioPosition(x, y, z) {
  localPosition = [x, y, z]
}

export function setRemoteAudioPosition(id, x, y, z) {
  peerPositions.set(id, [x, y, z])
}

export function removeRemoteAudio(id) {
  peerPositions.delete(id)
}

export function registerAudioElement(id, element) {
  audioElements.set(id, element)
  element.volume = 0
  element.muted = true
}

export function unregisterAudioElement(id) {
  audioElements.delete(id)
}

export function computeGain(distance) {
  if (!Number.isFinite(distance)) return 0
  if (distance >= FAR_DISTANCE) return 0
  const normalized = Math.min(1, Math.max(0, 1 - (distance - NEAR_DISTANCE) / (FAR_DISTANCE - NEAR_DISTANCE)))
  return normalized ** 1.6 * 0.92
}

export function distanceBetween(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Called on a timer; returns the closest audible peer for the HUD. */
export function updateAudioLevels() {
  let closest = null
  for (const [id, element] of audioElements) {
    const position = peerPositions.get(id)
    if (!position) {
      element.volume = 0
      element.muted = true
      continue
    }
    const distance = distanceBetween(localPosition, position)
    const gain = computeGain(distance)
    element.volume = gain
    element.muted = gain <= 0.01
    if (!closest || distance < closest.distance) closest = { id, distance, gain }
  }
  return closest
}

export function clearSpatialAudio() {
  for (const element of audioElements.values()) {
    element.srcObject = null
    element.remove()
  }
  audioElements.clear()
  peerPositions.clear()
  localPosition = [0, 0, 0]
}
