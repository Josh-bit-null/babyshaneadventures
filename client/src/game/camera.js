export const cameraControls = {
  yaw: 0,
  pitch: 0.48,
  distance: 16.8,
  minDistance: 5.5,
  maxDistance: 21,
  minPitch: 0.18,
  maxPitch: 1.12,
}

export function resetCamera() {
  cameraControls.yaw = 0
  cameraControls.pitch = 0.48
  cameraControls.distance = 9.4
}
