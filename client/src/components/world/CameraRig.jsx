import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { cameraControls } from '../../game/camera.js'
import { localState } from '../../game/state.js'

export default function CameraRig({ paused = false }) {
  const { camera, gl } = useThree()
  const target = useRef(new Vector3(0, 1.2, 3.6))
  const desired = useRef(new Vector3(0, 6, 12))
  const first = useRef(true)
  const drag = useRef({ active: false, x: 0, y: 0, moved: 0 })

  useEffect(() => {
    const canvas = gl.domElement
    const down = (event) => {
      if (event.button !== 0) return
      drag.current = { active: true, x: event.clientX, y: event.clientY, moved: 0 }
      canvas.setPointerCapture?.(event.pointerId)
    }
    const move = (event) => {
      if (!drag.current.active) return
      const dx = event.clientX - drag.current.x
      const dy = event.clientY - drag.current.y
      drag.current.x = event.clientX
      drag.current.y = event.clientY
      drag.current.moved += Math.abs(dx) + Math.abs(dy)
      if (drag.current.moved < 5) return
      cameraControls.yaw -= dx * 0.005
      cameraControls.pitch = Math.min(
        cameraControls.maxPitch,
        Math.max(cameraControls.minPitch, cameraControls.pitch - dy * 0.004),
      )
    }
    const up = (event) => {
      drag.current.active = false
      canvas.releasePointerCapture?.(event.pointerId)
    }
    const wheel = (event) => {
      event.preventDefault()
      cameraControls.distance = Math.min(
        cameraControls.maxDistance,
        Math.max(cameraControls.minDistance, cameraControls.distance + event.deltaY * 0.008),
      )
    }
    const cancel = () => {
      drag.current.active = false
    }

    canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('blur', cancel)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      canvas.removeEventListener('wheel', wheel)
      window.removeEventListener('blur', cancel)
    }
  }, [gl])

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05)
    const [x, y, z] = localState.p
    target.current.set(x, y + 1.05, z)

    const horizontal = Math.cos(cameraControls.pitch) * cameraControls.distance
    desired.current.set(
      x + Math.sin(cameraControls.yaw) * horizontal,
      y + 1.05 + Math.sin(cameraControls.pitch) * cameraControls.distance,
      z + Math.cos(cameraControls.yaw) * horizontal,
    )

    const damping = 1 - Math.exp(-(paused ? 5 : 9) * dt)
    if (first.current) {
      camera.position.copy(desired.current)
      first.current = false
    } else {
      camera.position.lerp(desired.current, damping)
    }
    camera.lookAt(target.current)
  })

  return null
}
