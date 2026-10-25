import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MathUtils } from 'three'
import { SafeModel } from './Model.jsx'
import { HOUSE } from '../../game/assets.js'

/** Sprout, the shared houseplant. Losing focus kills it; a new session revives it. */
export default function Houseplant({ health = 1, onOpen }) {
  const group = useRef()
  const glow = useRef()
  const alive = health > 0.5

  useFrame((state, delta) => {
    if (!group.current) return
    const dt = Math.min(delta, 0.05)
    group.current.rotation.z = MathUtils.damp(group.current.rotation.z, alive ? 0 : 0.6, 3.5, dt)
    group.current.rotation.x = MathUtils.damp(group.current.rotation.x, alive ? 0 : 0.18, 3.5, dt)
    group.current.scale.y = MathUtils.damp(group.current.scale.y, alive ? 1 : 0.82, 4, dt)
    group.current.position.y = MathUtils.damp(
      group.current.position.y,
      HOUSE.deckTop + (alive ? Math.sin(state.clock.elapsedTime * 1.4) * 0.01 : 0),
      4,
      dt,
    )
    if (glow.current) {
      glow.current.material.opacity = alive
        ? 0.14 + Math.sin(state.clock.elapsedTime * 2.2) * 0.05
        : 0
      glow.current.rotation.z = state.clock.elapsedTime * 0.3
    }
  })

  return (
    <group ref={group} position={[3.5, HOUSE.deckTop, -2.0]}>
      <mesh ref={glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.4, 0.52, 24]} />
        <meshBasicMaterial color={alive ? '#8fe0b4' : '#b49a86'} transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <SafeModel
        asset="furniture/pottedPlant.glb"
        height={1.18}
        tint={alive ? undefined : '#a58a5f'}
        position={[0, 0, 0]}
      />
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.35, 12]} />
        <meshStandardMaterial color={alive ? '#cf7c5f' : '#9b8572'} roughness={0.9} />
      </mesh>
      <Html
        position={[0, 1.5, 0]}
        center
        distanceFactor={9}
        zIndexRange={[18, 0]}
        style={{ pointerEvents: 'auto' }}
      >
        <button type="button" className={`plant-tag${alive ? '' : ' is-dead'}`} onClick={onOpen}>
          <span aria-hidden>{alive ? '🌱' : '🥀'}</span>
          <span>
            <strong>Sprout</strong>
            <small>{alive ? 'thriving' : 'needs a fresh session'}</small>
          </span>
        </button>
      </Html>
    </group>
  )
}
