import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MathUtils } from 'three'
import { SafeModel } from './Model.jsx'
import { clampPlacement, groundHeightAt } from './collision.js'

function Pet({ item, definition, seed }) {
  const group = useRef()
  const target = useRef([item.x, item.y, item.z])
  useFrame((state, delta) => {
    if (!group.current) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime + seed * 0.37
    const x = item.x + Math.sin(t * 0.36) * 1.35
    const z = item.z + Math.cos(t * 0.29) * 1.15
    const y = groundHeightAt(x, z)
    const dx = x - group.current.position.x
    const dz = z - group.current.position.z
    group.current.position.x = MathUtils.damp(group.current.position.x, x, 2.2, dt)
    group.current.position.z = MathUtils.damp(group.current.position.z, z, 2.2, dt)
    group.current.position.y = MathUtils.damp(group.current.position.y, y + Math.abs(Math.sin(t * 3.2)) * 0.05, 8, dt)
    if (Math.hypot(dx, dz) > 0.002) {
      const yaw = Math.atan2(dx, dz)
      const deltaYaw = Math.atan2(
        Math.sin(yaw - group.current.rotation.y),
        Math.cos(yaw - group.current.rotation.y),
      )
      group.current.rotation.y += deltaYaw * (1 - Math.exp(-4 * dt))
    }
    target.current = [x, y, z]
  })

  return (
    <group ref={group} position={[item.x, item.y, item.z]} scale={item.scale ?? 1}>
      <SafeModel
        asset={definition.asset}
        height={definition.height}
        tint={definition.tint}
        glow={definition.glow}
      />
    </group>
  )
}

function PlacedItem({ item, definition, selected }) {
  const ring = useRef()
  useFrame((state) => {
    if (!ring.current) return
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08
    ring.current.scale.setScalar(pulse)
  })

  if (definition.pet) {
    return <Pet item={item} definition={definition} seed={item.uid?.length ?? 3} />
  }

  return (
    <group
      position={[item.x, item.y, item.z]}
      rotation={[item.rx ?? 0, item.ry ?? 0, item.rz ?? 0]}
      scale={item.scale ?? 1}
    >
      <SafeModel
        asset={definition.asset}
        height={definition.height}
        tint={definition.tint}
        glow={definition.glow}
      />
      {selected ? (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.44, 0.56, 24]} />
          <meshBasicMaterial color="#ffb3c9" transparent opacity={0.75} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}

export function FurnitureLayer({ items, catalog, selectedUid }) {
  const bySku = useMemo(() => {
    const map = new Map()
    for (const item of catalog?.items ?? []) map.set(item.sku, item)
    return map
  }, [catalog])

  return (
    <group>
      {items.map((item) => {
        const definition = bySku.get(item.sku)
        if (!definition || definition.kind !== 'model') return null
        return (
          <PlacedItem
            key={item.uid}
            item={item}
            definition={definition}
            selected={item.uid === selectedUid}
          />
        )
      })}
    </group>
  )
}

/**
 * Tap the island to place the selected furniture. Uses the same snapping logic
 * on deck and grass, then PATCHes the exact transform to MariaDB.
 */
export function PlacementLayer({ placement, onPlace, catalog, selectedUid }) {
  const ring = useRef()
  const ghost = useRef()
  const last = useRef(null)
  const definition = useMemo(() => {
    if (!placement) return null
    return (catalog?.items ?? []).find((item) => item.sku === placement.sku) ?? null
  }, [placement, catalog])

  const update = (point) => {
    if (!ring.current) return
    const snapped = clampPlacement(point.x, point.z)
    last.current = snapped
    ring.current.position.set(snapped.x, snapped.y + 0.02, snapped.z)
    ring.current.visible = true
    if (ghost.current) {
      ghost.current.position.set(snapped.x, snapped.y, snapped.z)
    }
  }

  const commit = (event) => {
    event.stopPropagation()
    const snapped = clampPlacement(event.point.x, event.point.z)
    onPlace?.(snapped)
  }

  if (!placement) return null

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.21, 0]}
        onPointerMove={(event) => {
          event.stopPropagation()
          update(event.point)
        }}
        onClick={commit}
      >
        <circleGeometry args={[15.4, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={ring} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.58, 28]} />
          <meshBasicMaterial color="#ffd1de" transparent opacity={0.85} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 1.5, 6]} />
          <meshBasicMaterial color="#ffd1de" transparent opacity={0.35} />
        </mesh>
        <Html position={[0, 1.65, 0]} center distanceFactor={12} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="placement-tag">
            <strong>Tap to place</strong>
            <span>{definition?.icon} {definition?.name}</span>
          </div>
        </Html>
      </group>

      {definition && placement && selectedUid ? (
        <group ref={ghost}>
          <SafeModel
            asset={definition.asset}
            height={definition.height}
            opacity={0.45}
            tint={definition.tint}
          />
        </group>
      ) : null}
    </group>
  )
}
