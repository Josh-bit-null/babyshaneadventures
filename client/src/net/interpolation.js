/**
 * Entity interpolation.
 *
 * Network snapshots arrive at 20 Hz; rendering runs at 60–120 Hz. We render
 * `INTERP_DELAY_MS` behind the newest packet and glide between the two samples
 * that surround that render time. Never snap to the latest packet.
 */

export const INTERP_DELAY_MS = 120
export const MAX_SAMPLE_AGE_MS = 3000
export const MAX_SAMPLES = 40

export function lerp(a, b, t) {
  return a + (b - a) * t
}

/** Shortest-path normalized quaternion lerp (nlerp), stable and cheap. */
export function slerpQuat(a, b, t) {
  let [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  let dot = ax * bx + ay * by + az * bz + aw * bw
  if (dot < 0) {
    dot = -dot
    ax = -ax
    ay = -ay
    az = -az
    aw = -aw
  }

  let s0
  let s1
  if (dot > 0.9995) {
    s0 = 1 - t
    s1 = t
  } else {
    const theta = Math.acos(Math.min(1, Math.max(-1, dot)))
    const sinTheta = Math.sin(theta)
    s0 = Math.sin((1 - t) * theta) / sinTheta
    s1 = Math.sin(t * theta) / sinTheta
  }

  const x = s0 * ax + s1 * bx
  const y = s0 * ay + s1 * by
  const z = s0 * az + s1 * bz
  const w = s0 * aw + s1 * bw
  const length = Math.hypot(x, y, z, w) || 1
  return [x / length, y / length, z / length, w / length]
}

export function lerpVec3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

function blendSample(a, b, t) {
  return {
    p: lerpVec3(a.p, b.p, t),
    q: slerpQuat(a.q, b.q, t),
    moving: t < 0.5 ? Boolean(a.moving) : Boolean(b.moving),
  }
}

/**
 * @param {Array<{t:number,p:number[],q:number[],moving?:boolean}>} samples
 * @param {number} nowSeconds performance.now()/1000
 * @param {number} delayMs interpolation delay
 */
export function sampleEntity(samples, nowSeconds, delayMs = INTERP_DELAY_MS) {
  if (!Array.isArray(samples) || samples.length === 0) return null
  const target = nowSeconds - delayMs / 1000

  if (samples.length === 1 || target <= samples[0].t) {
    const first = samples[0]
    return { p: [...first.p], q: [...first.q], moving: Boolean(first.moving) }
  }

  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = samples[i]
    const b = samples[i + 1]
    if (target <= b.t) {
      const span = b.t - a.t
      const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (target - a.t) / span))
      return blendSample(a, b, t)
    }
  }

  const last = samples[samples.length - 1]
  return { p: [...last.p], q: [...last.q], moving: Boolean(last.moving) }
}

export function pushSample(samples, sample, nowSeconds) {
  const next = samples ? [...samples, sample] : [sample]
  const cutoff = nowSeconds - MAX_SAMPLE_AGE_MS / 1000
  while (next.length > 2 && next[0].t < cutoff) next.shift()
  if (next.length > MAX_SAMPLES) next.splice(0, next.length - MAX_SAMPLES)
  return next
}

export function yawToQuat(yaw) {
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]
}
