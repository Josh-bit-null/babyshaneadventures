export const SKIN_TONES = ['#fbe0c7', '#f3c9a6', '#e6b78f', '#c98f68', '#9c6549', '#6f4738']
export const HAIR_COLORS = ['#2f2623', '#4a332b', '#7a4a32', '#c08a4e', '#e3c58b', '#c95b7e', '#6c5ce7']
export const EYE_COLORS = ['#2b2420', '#5a3b2e', '#4c6b3f', '#3d6c8e', '#7a4f9e', '#b04a5a']
export const OUTFIT_COLORS = ['#e05252', '#f08a5d', '#f6c453', '#74c9a8', '#4db6e6', '#8b6cd9', '#f27ba8', '#5d6b8a']
export const BODY_TYPES = ['feminine', 'masculine', 'androgynous']
export const HAIR_STYLES = ['bob', 'buns', 'short', 'spiky', 'long', 'curly']
export const OUTFIT_STYLES = ['tee', 'hoodie', 'dress', 'overalls']
export const HATS = ['mushroom', 'siopao', 'beanie', 'none']
export const ACCESSORIES = ['none', 'glasses', 'blush', 'headphones']

export const AVATAR_DEFAULTS = {
  mushroom: {
    persona: 'mushroom',
    skinTone: '#f3c9a6',
    hairStyle: 'short',
    hairColor: '#4a332b',
    body: 'masculine',
    eyeSize: 1.05,
    eyeSpacing: 1,
    eyeColor: '#3b2a24',
    smile: 0.7,
    outfitStyle: 'hoodie',
    outfitColor: '#e05252',
    hat: 'mushroom',
    accessory: 'none',
    height: 1,
  },
  siopao: {
    persona: 'siopao',
    skinTone: '#f7d6bb',
    hairStyle: 'buns',
    hairColor: '#2f2623',
    body: 'feminine',
    eyeSize: 1.15,
    eyeSpacing: 0.95,
    eyeColor: '#2b2420',
    smile: 0.8,
    outfitStyle: 'dress',
    outfitColor: '#8b6cd9',
    hat: 'siopao',
    accessory: 'blush',
    height: 0.96,
  },
  guest: {
    persona: 'guest',
    skinTone: '#e6b78f',
    hairStyle: 'bob',
    hairColor: '#5c3a2e',
    body: 'androgynous',
    eyeSize: 1,
    eyeSpacing: 1,
    eyeColor: '#32261f',
    smile: 0.6,
    outfitStyle: 'tee',
    outfitColor: '#4db6a4',
    hat: 'none',
    accessory: 'none',
    height: 1,
  },
}

export function defaultAvatar(persona = 'guest') {
  return { ...(AVATAR_DEFAULTS[persona] ?? AVATAR_DEFAULTS.guest) }
}

export function withDefaults(config) {
  const persona = config?.persona ?? 'guest'
  return { ...defaultAvatar(persona), ...(config ?? {}), persona }
}

export const AVATAR_LABELS = {
  body: { feminine: 'Soft', masculine: 'Broad', androgynous: 'Balanced' },
  hairStyle: { bob: 'Bob', buns: 'Buns', short: 'Short', spiky: 'Spiky', long: 'Long', curly: 'Curly' },
  outfitStyle: { tee: 'Tee', hoodie: 'Hoodie', dress: 'Dress', overalls: 'Overalls' },
  hat: { mushroom: 'Mushroom cap', siopao: 'Siopao buns', beanie: 'Beanie', none: 'No hat' },
  accessory: { none: 'None', glasses: 'Glasses', blush: 'Blush', headphones: 'Headphones' },
}

export const ROOM_FALLBACK_PALETTE = {
  skyTop: '#a9ddf7',
  skyBottom: '#ffe6ee',
  horizon: '#fff3e2',
  fog: '#ffdce8',
  grass: '#a6dc94',
  grassDeep: '#7cc178',
  deck: '#e7bb8c',
  deckEdge: '#c99a6c',
  water: '#7fd2ea',
  ambient: '#fff2f6',
  sun: '#fff0c7',
  accent: '#ff94b8',
  night: false,
}

export function paletteFor(catalog, themeSku) {
  const theme = catalog?.themes?.[String(themeSku || '').replace('theme-', '')]
  return theme?.palette ?? ROOM_FALLBACK_PALETTE
}

export function themeName(catalog, themeSku) {
  const theme = catalog?.themes?.[String(themeSku || '').replace('theme-', '')]
  return theme?.name ?? 'Meadow Morning'
}
