import { yawToQuat } from '../net/interpolation.js'

/** Mutable local transform read by the send loop and written by the R3F loop. */
export const localState = {
  p: [0, 0, 3.6],
  q: yawToQuat(Math.PI),
  yaw: Math.PI,
  moving: false,
  speed: 0,
  ready: false,
  placement: null,
}

export function setLocalPosition(x, y, z) {
  localState.p[0] = x
  localState.p[1] = y
  localState.p[2] = z
}

export function setLocalYaw(yaw) {
  localState.yaw = yaw
  localState.q = yawToQuat(yaw)
}

export function setPlacement(item) {
  localState.placement = item
}

export function clearPlacement() {
  localState.placement = null
}

/** Shared selection state for spatial audio. */
export const worldPositions = {
  local: [0, 0, 3.6],
  remotes: new Map(),
}
