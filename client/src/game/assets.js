import { useGLTF } from '@react-three/drei'

const configured = (import.meta.env.VITE_R2_ASSET_BASE_URL || '').replace(/\/$/, '')
export const ASSET_BASE = configured || '/models'

export const assetUrl = (path) => `${ASSET_BASE}/${String(path).replace(/^\//, '')}`

export const HOUSE = {
  center: [0, 0, -3.15],
  deckWidth: 18.0,
  deckDepth: 20.0,
  deckTop: 0.16,
  deckFrontZ: 6.85,
  deckBackZ: -13.15,
  houseWidth: 14.1,
  houseDepth: 14.1,
  houseFrontZ: 3.9,
  houseBackZ: -10.2,
  wallHeight: 4.0,
  roofRise: 2.5,
}

export const ENVIRONMENT = [
  // Trees ringing the island
  { asset: 'nature/tree_default.glb', x: -9.5, z: -4.5, height: 4.4, ry: 0.6 },
  { asset: 'nature/tree_oak.glb', x: 9.8, z: -5.4, height: 4.7, ry: 2.1 },
  { asset: 'nature/tree_pineTallA.glb', x: -11.4, z: 2.8, height: 5.2, ry: 1.2 },
  { asset: 'nature/tree_small.glb', x: 11.2, z: 2.2, height: 2.9, ry: 0.4 },
  { asset: 'nature/tree_fat.glb', x: 10.7, z: -10.2, height: 4.1, ry: 1.8 },
  { asset: 'nature/tree_palm.glb', x: 12.6, z: 8.2, height: 5.4, ry: 2.7 },
  { asset: 'nature/tree_default.glb', x: -10.8, z: 9.6, height: 4.0, ry: 3.4 },
  { asset: 'nature/tree_small.glb', x: 5.9, z: 11.4, height: 2.6, ry: 1.1 },
  { asset: 'nature/tree_oak.glb', x: -6.4, z: 12.4, height: 3.8, ry: 4.2 },
  // Mushroom clusters — a nod to Mushroom Joshua
  { asset: 'nature/mushroom_red.glb', x: -7.7, z: 5.4, height: 0.7, ry: 0.2 },
  { asset: 'nature/mushroom_red.glb', x: -7.1, z: 4.8, height: 0.45, ry: 1.4, scale: 0.8 },
  { asset: 'nature/mushroom_tan.glb', x: 7.6, z: -7.3, height: 0.5, ry: 2.1 },
  { asset: 'nature/mushroom_redTall.glb', x: 8.4, z: 6.9, height: 1.0, ry: 0.7 },
  { asset: 'nature/mushroom_red.glb', x: 6.9, z: 7.6, height: 0.5, ry: 3.1 },
  { asset: 'nature/mushroom_tan.glb', x: -4.9, z: -10.6, height: 0.55, ry: 0.4 },
  // Flowers
  { asset: 'nature/flower_redA.glb', x: -5.6, z: 3.8, height: 0.32, ry: 0.1 },
  { asset: 'nature/flower_yellowA.glb', x: -4.5, z: 3.3, height: 0.3, ry: 1.2 },
  { asset: 'nature/flower_purpleA.glb', x: 5.4, z: 3.1, height: 0.3, ry: 2.2 },
  { asset: 'nature/flower_redA.glb', x: 6.2, z: 2.1, height: 0.32, ry: 0.8 },
  { asset: 'nature/flower_yellowA.glb', x: -8.9, z: -1.7, height: 0.3, ry: 2.8 },
  { asset: 'nature/flower_purpleA.glb', x: 9.1, z: -1.2, height: 0.3, ry: 1.6 },
  { asset: 'nature/flower_redA.glb', x: 3.2, z: 6.6, height: 0.3, ry: 0.4 },
  { asset: 'nature/flower_yellowA.glb', x: -2.7, z: 7.2, height: 0.3, ry: 1.9 },
  { asset: 'nature/flower_purpleA.glb', x: -12.0, z: 6.4, height: 0.34, ry: 0.9 },
  // Bushes and rocks
  { asset: 'nature/plant_bush.glb', x: -6.8, z: -8.4, height: 1.0, ry: 1.3 },
  { asset: 'nature/plant_bushLarge.glb', x: 8.2, z: -3.6, height: 1.3, ry: 2.6 },
  { asset: 'nature/plant_bush.glb', x: 6.4, z: 9.8, height: 0.9, ry: 0.2 },
  { asset: 'nature/rock_largeA.glb', x: -12.6, z: -6.8, height: 1.2, ry: 0.5 },
  { asset: 'nature/rock_smallA.glb', x: -11.8, z: -5.4, height: 0.45, ry: 1.1 },
  { asset: 'nature/rock_smallC.glb', x: 12.1, z: -6.9, height: 0.4, ry: 2.2 },
  { asset: 'nature/rock_largeA.glb', x: 12.8, z: 5.2, height: 1.0, ry: 1.6 },
  { asset: 'nature/rock_smallA.glb', x: 4.9, z: -11.0, height: 0.4, ry: 0.3 },
  { asset: 'nature/rock_smallC.glb', x: -3.4, z: 10.8, height: 0.35, ry: 1.9 },
  // Grass and crops
  { asset: 'nature/grass_large.glb', x: -3.2, z: 5.3, height: 0.5, ry: 0.4 },
  { asset: 'nature/grass_large.glb', x: 4.2, z: 7.2, height: 0.45, ry: 2.3 },
  { asset: 'nature/grass.glb', x: -8.1, z: 7.4, height: 0.35, ry: 1.0 },
  { asset: 'nature/grass.glb', x: 9.6, z: 0.8, height: 0.35, ry: 2.8 },
  { asset: 'nature/crop_pumpkin.glb', x: 10.2, z: -2.6, height: 0.5, ry: 0.4 },
  { asset: 'nature/crop_carrot.glb', x: 10.4, z: -1.6, height: 0.3, ry: 1.4 },
  { asset: 'nature/log.glb', x: -9.3, z: 10.4, height: 0.5, ry: 2.4 },
]

export const ENV_ASSETS = [...new Set(ENVIRONMENT.map((item) => item.asset))]

export const PRELOAD_ASSETS = [
  ...ENV_ASSETS,
  'house/wall.glb',
  'house/wall-window-wide-square.glb',
  'house/wall-doorway-wide-square.glb',
  'house/wall-corner.glb',
  'pets/animal-cat.glb',
  'pets/animal-bunny.glb',
]

export function preloadAssets(assets = PRELOAD_ASSETS) {
  for (const asset of assets) {
    try {
      useGLTF.preload(assetUrl(asset))
    } catch {
      /* preload is best-effort */
    }
  }
}

export function preloadCatalog(catalog) {
  if (!catalog?.items) return
  const assets = catalog.items
    .filter((item) => item.kind === 'model')
    .map((item) => item.asset)
  preloadAssets([...new Set([...PRELOAD_ASSETS, ...assets])])
}

export const MODEL_ASSET_COUNT = new Set([
  ...PRELOAD_ASSETS,
  ...ENVIRONMENT.map((item) => item.asset),
]).size
