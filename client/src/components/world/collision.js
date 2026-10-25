import { Box3, BoxGeometry, Mesh, Ray, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { HOUSE } from '../../game/assets.js'

/**
 * Static colliders are merged into one geometry and grouped into a single
 * MeshBVH. Movement is resolved with BVH raycasts (no per-triangle scene scans),
 * which is what keeps mobile collision checks cheap.
 */
const BOXES = [
  // house rear and side walls; the front doorway stays open for entry.
  { p: [0, HOUSE.deckTop + HOUSE.wallHeight / 2, HOUSE.houseBackZ], s: [HOUSE.houseWidth, HOUSE.wallHeight, 0.32] },
  { p: [-HOUSE.houseWidth / 2, HOUSE.deckTop + HOUSE.wallHeight / 2, HOUSE.center[2]], s: [0.32, HOUSE.wallHeight, HOUSE.houseDepth] },
  { p: [HOUSE.houseWidth / 2, HOUSE.deckTop + HOUSE.wallHeight / 2, HOUSE.center[2]], s: [0.32, HOUSE.wallHeight, HOUSE.houseDepth] },
  // fixed interactables (adjusted)
  { p: [10.0, 0.38, 1.0], s: [1.6, 0.75, 0.7] },
  { p: [-10.0, 1.05, 1.0], s: [0.55, 2.1, 0.28] },
  { p: [10.0, 0.45, -4.0], s: [0.6, 0.9, 0.6] },
  // tree trunks (adjusted for larger island)
  { p: [-12.0, 1.5, -5.0], s: [0.55, 3, 0.55] },
  { p: [12.0, 1.5, -5.0], s: [0.55, 3, 0.55] },
  { p: [-13.0, 1.5, 3.0], s: [0.5, 3, 0.5] },
  { p: [13.0, 1.2, 3.5], s: [0.4, 2.4, 0.4] },
  { p: [13.0, 1.4, -9.0], s: [0.5, 2.8, 0.5] },
  { p: [-13.0, 1.3, 11.0], s: [0.5, 2.6, 0.5] },
  { p: [-7.0, 1.2, 13.0], s: [0.5, 2.5, 0.5] },
  // large rocks (adjusted)
  { p: [-14.0, 0.6, -7.5], s: [1.4, 1.2, 1.2] },
  { p: [14.5, 0.5, 6.0], s: [1.3, 1.0, 1.2] },
]

function buildCollider() {
  const geometries = BOXES.map(({ p, s }) => {
    const geometry = new BoxGeometry(s[0], s[1], s[2])
    geometry.translate(p[0], p[1], p[2])
    return geometry
  })
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  const bvh = new MeshBVH(merged, { maxLeafTris: 8 })
  merged.boundsTree = bvh

  const mesh = new Mesh(merged)
  mesh.raycast = acceleratedRaycast
  mesh.updateMatrixWorld(true)

  return { bvh, mesh, bounds: new Box3().setFromBufferAttribute(merged.attributes.position) }
}

let cached = null
export function getCollider() {
  if (!cached) cached = buildCollider()
  return cached
}

export const PLAYER_RADIUS = 0.36
export const ISLAND_RADIUS = 22.0

export function groundHeightAt(x, z) {
  if (
    x >= -HOUSE.deckWidth / 2 + 0.1 &&
    x <= HOUSE.deckWidth / 2 - 0.1 &&
    z >= HOUSE.center[2] - HOUSE.deckDepth / 2 + 0.1 &&
    z <= HOUSE.center[2] + HOUSE.deckDepth / 2 - 0.05
  ) {
    return HOUSE.deckTop
  }
  return 0
}

const ray = new Ray()
const origin = new Vector3()
const direction = new Vector3()

function blocked(x, z, dx, dz, distance) {
  const { bvh } = getCollider()
  const length = Math.hypot(dx, dz)
  if (length < 0.00001) return false
  direction.set(dx / length, 0, dz / length)
  origin.set(x, 0.42, z)
  ray.set(origin, direction)
  const far = distance + PLAYER_RADIUS
  const hits = bvh.raycast(ray, 0, 0, far)
  if (hits?.length) return true
  // Also check a small height off ground to catch thin obstacles
  origin.set(x, 1.05, z)
  ray.set(origin, direction)
  const hits2 = bvh.raycast(ray, 0, 0, far)
  if (hits2?.length) return true
  return false
}

/**
 * Slide along walls by resolving X and Z independently, then clamp to the island.
 */
export function resolveMovement(fromX, fromZ, toX, toZ) {
  let x = fromX
  let z = fromZ
  const dx = toX - fromX
  const dz = toZ - fromZ

  if (Math.abs(dx) > 0.00001) {
    if (!blocked(x, z, dx, 0, Math.abs(dx))) x += dx
  }
  if (Math.abs(dz) > 0.00001) {
    if (!blocked(x, z, 0, dz, Math.abs(dz))) z += dz
  }

  // diagonal corner catch: if the resolved point overlaps, push back
  if (blocked(x, z, 1, 0, 0.08) && blocked(x, z, -1, 0, 0.08)) {
    x = fromX
  }

  const radius = Math.hypot(x, z)
  if (radius > ISLAND_RADIUS) {
    x = (x / radius) * ISLAND_RADIUS
    z = (z / radius) * ISLAND_RADIUS
  }

  return { x, z }
}

export function clampPlacement(x, z) {
  const radius = Math.hypot(x, z)
  const max = ISLAND_RADIUS - 0.4
  const scale = radius > max ? max / radius : 1
  const cx = Number((x * scale).toFixed(2))
  const cz = Number((z * scale).toFixed(2))
  const onDeck =
    Math.abs(cx) <= HOUSE.deckWidth / 2 - 0.35 &&
    cz >= HOUSE.center[2] - HOUSE.deckDepth / 2 + 0.35 &&
    cz <= HOUSE.center[2] + HOUSE.deckDepth / 2 - 0.2
  return { x: cx, z: cz, y: onDeck ? HOUSE.deckTop : 0 }
}
