import { useEffect } from 'react'

/**
 * Shared input store. React does not re-render for input; the R3F loop reads
 * these values every frame.
 */
export const input = {
  keys: new Set(),
  joystickX: 0,
  joystickY: 0,
  joystickActive: false,
  touchLookX: 0,
  touchLookY: 0,
}

const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
}

function isTypingTarget(target) {
  if (!target) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function setJoystick(x, y, active = true) {
  input.joystickX = x
  input.joystickY = y
  input.joystickActive = active
}

export function clearJoystick() {
  input.joystickX = 0
  input.joystickY = 0
  input.joystickActive = false
}

export function readMoveVector() {
  let x = 0
  let y = 0
  if (input.keys.has('forward')) y += 1
  if (input.keys.has('back')) y -= 1
  if (input.keys.has('right')) x += 1
  if (input.keys.has('left')) x -= 1
  if (input.joystickActive) {
    x += input.joystickX
    y += input.joystickY
  }
  const length = Math.hypot(x, y)
  if (length > 1) {
    x /= length
    y /= length
  }
  return { x, y, sprint: input.keys.has('sprint') }
}

export function useKeyboardInput({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined
    const down = (event) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      const action = KEY_MAP[event.code]
      if (!action) return
      event.preventDefault()
      input.keys.add(action)
    }
    const up = (event) => {
      const action = KEY_MAP[event.code]
      if (!action) return
      input.keys.delete(action)
    }
    const blur = () => input.keys.clear()
    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      input.keys.clear()
    }
  }, [enabled])
}
