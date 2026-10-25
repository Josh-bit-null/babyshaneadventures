const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent

// The joystick is mounted only when the user agent (or touch capability) says
// this is a phone/tablet. Desktop users get WASD exclusively.
export const isMobileDevice =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Silk/i.test(ua) ||
  Boolean(navigator.userAgentData?.mobile) ||
  (navigator.maxTouchPoints > 1 && window.matchMedia?.('(pointer: coarse)')?.matches)

export const isTouchDevice =
  'ontouchstart' in window || navigator.maxTouchPoints > 0

export const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone =
  window.matchMedia?.('(display-mode: standalone)')?.matches ||
  window.navigator.standalone === true

export const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

export const supportsWebGL = (() => {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    )
  } catch {
    return false
  }
})()
