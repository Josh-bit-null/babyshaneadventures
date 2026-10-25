import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { AvatarFigure, NameTag } from './Avatar.jsx'
import { readMoveVector } from '../../game/input.js'
import { cameraControls } from '../../game/camera.js'
import { localState, setLocalYaw } from '../../game/state.js'
import { groundHeightAt, resolveMovement } from './collision.js'
import { setLocalAudioPosition } from '../../game/spatialAudio.js'

export default function PlayerController({
  user,
  paused,
  placing,
  voiceEnabled,
  selfPositionRef,
  selfId,
}) {
  const group = useRef()
  const walkRef = useRef(false)
  const yawRef = useRef(localState.yaw)
  const groundedRef = useRef(false)
  const speedRef = useRef(0)

  useEffect(() => {
    if (paused) {
      walkRef.current = false
      localState.moving = false
    }
  }, [paused])

  useFrame((_state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    if (!group.current) return

    const canMove = !paused && !placing
    const move = canMove ? readMoveVector() : { x: 0, y: 0, sprint: false }
    const hasInput = Math.hypot(move.x, move.y) > 0.02

    let vx = 0
    let vz = 0
    if (hasInput) {
      const yaw = cameraControls.yaw
      const forwardX = -Math.sin(yaw)
      const forwardZ = -Math.cos(yaw)
      const rightX = Math.cos(yaw)
      const rightZ = -Math.sin(yaw)
      vx = rightX * move.x + forwardX * move.y
      vz = rightZ * move.x + forwardZ * move.y
      const length = Math.hypot(vx, vz) || 1
      vx /= length
      vz /= length
      const speed = move.sprint ? 5.1 : 3.45
      vx *= speed
      vz *= speed
    }

    const distance = Math.hypot(vx, vz) * dt
    const resolved = distance > 0.00001
      ? resolveMovement(
          localState.p[0],
          localState.p[2],
          localState.p[0] + vx * dt,
          localState.p[2] + vz * dt,
        )
      : { x: localState.p[0], z: localState.p[2] }

    const ground = groundHeightAt(resolved.x, resolved.z)
    localState.p[0] = resolved.x
    localState.p[1] = MathUtils.damp(localState.p[1], ground, 14, dt)
    localState.p[2] = resolved.z

    const moved = Math.hypot(resolved.x - group.current.position.x, resolved.z - group.current.position.z) > 0.0004
    const moving = hasInput && moved
    localState.moving = moving
    speedRef.current = MathUtils.damp(speedRef.current, moving ? Math.hypot(vx, vz) : 0, 8, dt)
    localState.speed = speedRef.current
    walkRef.current = moving

    if (hasInput) {
      const targetYaw = Math.atan2(vx, vz)
      const delta = Math.atan2(
        Math.sin(targetYaw - yawRef.current),
        Math.cos(targetYaw - yawRef.current),
      )
      yawRef.current += delta * (1 - Math.exp(-15 * dt))
      setLocalYaw(yawRef.current)
    }

    groundedRef.current = ground
    group.current.position.set(localState.p[0], localState.p[1], localState.p[2])
    group.current.quaternion.set(localState.q[0], localState.q[1], localState.q[2], localState.q[3])

    if (selfPositionRef) {
      selfPositionRef.current[0] = localState.p[0]
      selfPositionRef.current[1] = localState.p[1]
      selfPositionRef.current[2] = localState.p[2]
    }
    setLocalAudioPosition(localState.p[0], localState.p[1], localState.p[2])
  })

  return (
    <group ref={group} position={localState.p}>
      <AvatarFigure
        config={user.avatarConfig}
        rpmAvatarUrl={user.rpmAvatarUrl}
        walkRef={walkRef}
        seed={selfId ?? 0}
      />
      <NameTag
        name={user.displayName?.split(' ')[0] || 'You'}
        isSelf
        voiceEnabled={voiceEnabled}
        color="#74c9a8"
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[0.42, 0.47, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  )
}
