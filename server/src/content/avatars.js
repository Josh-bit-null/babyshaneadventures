/**
 * Avatar Studio configuration. Ready Player Me's hosted creator and API were
 * shut down on 31 Jan 2026, so the default entities are rendered natively from
 * this config and any previously exported Ready Player Me .glb URL can still be
 * mapped straight into the R3F scene.
 */

export const HAIR_STYLES = ['bob', 'buns', 'short', 'spiky', 'long', 'curly']
export const OUTFIT_STYLES = ['tee', 'hoodie', 'dress', 'overalls']
export const HATS = ['mushroom', 'siopao', 'beanie', 'none']
export const ACCESSORIES = ['none', 'glasses', 'blush', 'headphones']
export const BODY_TYPES = ['feminine', 'masculine', 'androgynous']

const HEX = /^#[0-9a-f]{6}$/i
const clamp = (value, min, max, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)
const colour = (value, fallback) => (HEX.test(String(value)) ? String(value).toLowerCase() : fallback)

export const DEFAULT_AVATARS = {
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
  return structuredClone(DEFAULT_AVATARS[persona] ?? DEFAULT_AVATARS.guest)
}

export function sanitizeAvatar(input, fallbackPersona = 'guest') {
  const base = defaultAvatar(
    ['mushroom', 'siopao', 'guest'].includes(input?.persona)
      ? input.persona
      : fallbackPersona,
  )
  if (!input || typeof input !== 'object') return base
  return {
    persona: base.persona,
    skinTone: colour(input.skinTone, base.skinTone),
    hairStyle: pick(input.hairStyle, HAIR_STYLES, base.hairStyle),
    hairColor: colour(input.hairColor, base.hairColor),
    body: pick(input.body, BODY_TYPES, base.body),
    eyeSize: clamp(input.eyeSize, 0.6, 1.5, base.eyeSize),
    eyeSpacing: clamp(input.eyeSpacing, 0.6, 1.5, base.eyeSpacing),
    eyeColor: colour(input.eyeColor, base.eyeColor),
    smile: clamp(input.smile, 0, 1, base.smile),
    outfitStyle: pick(input.outfitStyle, OUTFIT_STYLES, base.outfitStyle),
    outfitColor: colour(input.outfitColor, base.outfitColor),
    hat: pick(input.hat, HATS, base.hat),
    accessory: pick(input.accessory, ACCESSORIES, base.accessory),
    height: clamp(input.height, 0.85, 1.12, 1),
  }
}

export function sanitizeAvatarUrl(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || value.length > 1024) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}
