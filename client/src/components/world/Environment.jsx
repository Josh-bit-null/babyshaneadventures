import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, DoubleSide, Shape } from 'three'
import { SafeModel } from './Model.jsx'
import { ISLAND_RADIUS } from './collision.js'
import { ENVIRONMENT, HOUSE } from '../../game/assets.js'
import { localState } from '../../game/state.js'

function Sky({ palette }) {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new Color(palette.skyTop) },
      bottomColor: { value: new Color(palette.skyBottom) },
      horizonColor: { value: new Color(palette.horizon) },
    }),
    [palette],
  )

  return (
    <mesh scale={[95, 95, 95]} renderOrder={-10}>
      <sphereGeometry args={[1, 28, 18]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`\n          varying vec3 vWorldPosition;\n          void main() {\n            vec4 world = modelMatrix * vec4(position, 1.0);\n            vWorldPosition = world.xyz;\n            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n          }\n        `}
        fragmentShader={`\n          uniform vec3 topColor;\n          uniform vec3 bottomColor;\n          uniform vec3 horizonColor;\n          varying vec3 vWorldPosition;\n          void main() {\n            float h = normalize(vWorldPosition).y;\n            vec3 col = mix(bottomColor, horizonColor, smoothstep(-0.22, 0.08, h));\n            col = mix(col, topColor, smoothstep(0.04, 0.7, h));\n            gl_FragColor = vec4(col, 1.0);\n          }\n        `}
      />
    </mesh>
  )
}

function Stars({ accent }) {
  const geometry = useMemo(() => {
    const count = 260
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const angle = i * 2.399963
      const radius = 55 + (i % 7) * 4
      const height = 8 + ((i * 37) % 40)
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = height
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    const buffer = new Float32Array(positions)
    return { positions: buffer }
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={accent} size={0.42} sizeAttenuation transparent opacity={0.8} depthWrite={false} />
    </points>
  )
}

function Clouds({ night }) {
  const group = useRef()
  const data = useMemo(
    () => [
      { x: -16, y: 13, z: -22, s: 1.3, speed: 0.09 },
      { x: 20, y: 16, z: -10, s: 1.7, speed: 0.06 },
      { x: -6, y: 11, z: 24, s: 1.1, speed: 0.08 },
      { x: 26, y: 19, z: 14, s: 2, speed: 0.05 },
      { x: -28, y: 18, z: 4, s: 1.6, speed: 0.07 },
    ],
    [],
  )
  const refs = useRef([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((node, index) => {
      if (!node) return
      const base = data[index]
      node.position.x = base.x + Math.sin(t * base.speed + index) * 3.5
      node.position.y = base.y + Math.sin(t * 0.3 + index * 2) * 0.35
    })
  })

  const color = night ? '#a9a3d9' : '#fff9fb'
  return (
    <group ref={group}>
      {data.map((cloud, index) => (
        <group
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          position={[cloud.x, cloud.y, cloud.z]}
          scale={cloud.s}
        >
          <mesh>
            <sphereGeometry args={[1.3, 10, 8]} />
            <meshStandardMaterial color={color} roughness={1} transparent opacity={0.82} />
          </mesh>
          <mesh position={[1.35, -0.15, 0.1]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={color} roughness={1} transparent opacity={0.82} />
          </mesh>
          <mesh position={[-1.2, -0.2, -0.1]}>
            <sphereGeometry args={[0.9, 10, 8]} />
            <meshStandardMaterial color={color} roughness={1} transparent opacity={0.82} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Water({ palette }) {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    ref.current.position.y = -3.45 + Math.sin(state.clock.elapsedTime * 0.35) * 0.05
  })
  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[95, 48]} />
        <meshStandardMaterial
          color={palette.water}
          roughness={0.28}
          metalness={0.15}
          transparent
          opacity={0.94}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[15.8, 19.5, 40]} />
        <meshBasicMaterial color={palette.horizon} transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Island({ palette }) {
  const radius = ISLAND_RADIUS
  return (
    <group>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[radius, radius, 0.28, 32]} />
        <meshStandardMaterial color={palette.deck} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, -0.07, 0]}>
        <cylinderGeometry args={[radius - 0.25, radius - 0.25, 0.16, 32]} />
        <meshStandardMaterial color={palette.grass} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, -2.3, 0]}>
        <cylinderGeometry args={[radius - 1.0, radius - 1.0, 4.4, 24]} />
        <meshStandardMaterial color={palette.grassDeep} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, -6.35, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius * 0.8, radius * 0.8 * 0.6, 12]} />
        <meshStandardMaterial color="#8f7a68" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, -4.8, 0]}>
        <cylinderGeometry args={[radius - 1.5, radius - 1.5, 1.2, 20]} />
        <meshStandardMaterial color="#9b8470" roughness={1} flatShading />
      </mesh>
    </group>
  )
}

function Pond() {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = state.clock.elapsedTime * 0.05
    }
  })
  return (
    <group position={[9.3, 0.01, 4.9]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.1, 28]} />
        <meshStandardMaterial color="#8fdfe8" roughness={0.25} metalness={0.1} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[2.05, 2.35, 28]} />
        <meshStandardMaterial color="#d9c8a9" roughness={0.9} />
      </mesh>
      <group ref={ref}>
        {[
          [-0.6, 0.012, 0.4, 0.32],
          [0.7, 0.012, -0.3, 0.25],
          [0.1, 0.012, 0.9, 0.2],
        ].map(([x, y, z, size], index) => (
          <mesh key={index} position={[x, y, z]} rotation={[-Math.PI / 2, 0, index]}>
            <circleGeometry args={[size, 12]} />
            <meshStandardMaterial color="#7fc97f" roughness={0.9} />
          </mesh>
        ))}
      </group>
      <mesh position={[0.4, 0.18, 0.15]}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshStandardMaterial color="#f58aa4" roughness={0.7} />
      </mesh>
    </group>
  )
}

function Path() {
  const stones = [
    [0.2, 8.2, 0.55],
    [-0.5, 7.2, 0.48],
    [0.3, 6.2, 0.5],
    [-0.4, 5.2, 0.45],
    [0.2, 4.3, 0.52],
    [-0.2, 3.4, 0.46],
    [0.1, 2.8, 0.4],
  ]
  return (
    <group>
      {stones.map(([x, z, size], index) => (
        <mesh key={index} position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, index * 0.6]}>
          <circleGeometry args={[size, 7]} />
          <meshStandardMaterial color="#e5d4b8" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Deck({ palette }) {
  const planks = useMemo(() => Array.from({ length: 20 }, (_, index) => index), [])
  const plankSpacing = (HOUSE.deckDepth - 0.7) / (planks.length - 1)
  const halfDepth = HOUSE.deckDepth / 2
  const entryWidth = 2.5
  return (
    <group position={[0, HOUSE.deckTop / 2, HOUSE.center[2]]}>
      <mesh>
        <boxGeometry args={[HOUSE.deckWidth, HOUSE.deckTop, HOUSE.deckDepth]} />
        <meshStandardMaterial color={palette.deck} roughness={0.9} />
      </mesh>
      {planks.map((index) => (
        <mesh
          key={index}
          position={[0, HOUSE.deckTop / 2 + 0.002, -halfDepth + 0.35 + index * plankSpacing]}
        >
          <boxGeometry args={[HOUSE.deckWidth - 0.2, 0.006, 0.035]} />
          <meshStandardMaterial color={palette.deckEdge} transparent opacity={0.38} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[
            side * (entryWidth / 2 + (HOUSE.deckWidth - entryWidth) / 4),
            -0.1,
            halfDepth - 0.05,
          ]}
        >
          <boxGeometry args={[(HOUSE.deckWidth - entryWidth) / 2, 0.2, 0.14]} />
          <meshStandardMaterial color={palette.deckEdge} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, -0.1, -halfDepth + 0.05]}>
        <boxGeometry args={[HOUSE.deckWidth, 0.2, 0.14]} />
        <meshStandardMaterial color={palette.deckEdge} roughness={0.9} />
      </mesh>
      <mesh position={[-HOUSE.deckWidth / 2 + 0.06, -0.1, 0]}>
        <boxGeometry args={[0.14, 0.2, HOUSE.deckDepth]} />
        <meshStandardMaterial color={palette.deckEdge} roughness={0.9} />
      </mesh>
      <mesh position={[HOUSE.deckWidth / 2 - 0.06, -0.1, 0]}>
        <boxGeometry args={[0.14, 0.2, HOUSE.deckDepth]} />
        <meshStandardMaterial color={palette.deckEdge} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.08, halfDepth + 0.38]}>
        <boxGeometry args={[entryWidth, 0.16, 0.65]} />
        <meshStandardMaterial color={palette.deckEdge} roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.16, halfDepth + 0.92]}>
        <boxGeometry args={[entryWidth, 0.12, 0.48]} />
        <meshStandardMaterial color={palette.deckEdge} roughness={0.9} />
      </mesh>
    </group>
  )
}

function GableEnd({ z, back, palette }) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(-HOUSE.houseWidth / 2, 0)
    shape.lineTo(HOUSE.houseWidth / 2, 0)
    shape.lineTo(0, HOUSE.roofRise)
    shape.closePath()
    return shape
  }, [])

  return (
    <mesh
      position={[0, HOUSE.deckTop + HOUSE.wallHeight, z]}
      rotation={[0, back ? Math.PI : 0, 0]}
    >
      <shapeGeometry args={[geometry]} />
      <meshStandardMaterial
        color={palette.night ? '#776477' : '#f4dfc7'}
        roughness={0.92}
        side={DoubleSide}
      />
    </mesh>
  )
}

function House({ palette }) {
  const wallTint = palette.night ? '#d8c9bd' : '#f7e7d3'
  const halfWidth = HOUSE.houseWidth / 2
  const panelWidth = HOUSE.houseDepth / 3
  const panelCenters = [-panelWidth, 0, panelWidth]
  const roofAngle = Math.atan2(HOUSE.roofRise, halfWidth)
  const wallTop = HOUSE.deckTop + HOUSE.wallHeight
  const lights = useMemo(() => Array.from({ length: 9 }, (_, index) => index), [])
  const roofRef = useRef()
  const frontRef = useRef()
  const frontGableRef = useRef()

  useFrame(() => {
    const [x, , z] = localState.p
    const inside =
      Math.abs(x) < halfWidth - 0.45 &&
      z < HOUSE.houseFrontZ - 0.35 &&
      z > HOUSE.houseBackZ + 0.35
    if (roofRef.current) roofRef.current.visible = !inside
    if (frontRef.current) frontRef.current.visible = !inside
    if (frontGableRef.current) frontGableRef.current.visible = !inside
  })

  return (
    <group>
      <Deck palette={palette} />

      <group ref={frontRef}>
        {panelCenters.map((x, index) => (
          <SafeModel
            key={`front-${index}`}
            asset={index === 1 ? 'house/wall-doorway-wide-square.glb' : 'house/wall-window-wide-square.glb'}
            height={HOUSE.wallHeight}
            tint={wallTint}
            position={[x, HOUSE.deckTop, HOUSE.houseFrontZ]}
            rotation={[0, Math.PI / 2, 0]}
          />
        ))}
      </group>
      {panelCenters.map((x, index) => (
        <SafeModel
          key={`back-${index}`}
          asset="house/wall-window-wide-square.glb"
          height={HOUSE.wallHeight}
          tint={wallTint}
          position={[x, HOUSE.deckTop, HOUSE.houseBackZ]}
          rotation={[0, -Math.PI / 2, 0]}
        />
      ))}
      {[-1, 1].flatMap((side) =>
        panelCenters.map((offset, index) => (
          <SafeModel
            key={`side-${side}-${index}`}
            asset="house/wall-window-wide-square.glb"
            height={HOUSE.wallHeight}
            tint={wallTint}
            position={[side * halfWidth, HOUSE.deckTop, HOUSE.center[2] + offset]}
            rotation={[0, side < 0 ? Math.PI : 0, 0]}
          />
        )),
      )}

      <group ref={frontGableRef}>
        <GableEnd z={HOUSE.houseFrontZ - 0.02} palette={palette} />
      </group>
      <GableEnd z={HOUSE.houseBackZ + 0.02} back palette={palette} />

      <group ref={roofRef}>
        <mesh
          position={[halfWidth / 2, wallTop + HOUSE.roofRise / 2, HOUSE.center[2]]}
          rotation={[0, 0, -roofAngle]}
        >
          <boxGeometry args={[Math.hypot(halfWidth, HOUSE.roofRise) + 0.45, 0.24, HOUSE.houseDepth + 1.0]} />
          <meshStandardMaterial color={palette.night ? '#55435e' : '#b85e55'} roughness={0.92} />
        </mesh>
        <mesh
          position={[-halfWidth / 2, wallTop + HOUSE.roofRise / 2, HOUSE.center[2]]}
          rotation={[0, 0, roofAngle]}
        >
          <boxGeometry args={[Math.hypot(halfWidth, HOUSE.roofRise) + 0.45, 0.24, HOUSE.houseDepth + 1.0]} />
          <meshStandardMaterial color={palette.night ? '#55435e' : '#b85e55'} roughness={0.92} />
        </mesh>
        <mesh
          position={[0, wallTop + HOUSE.roofRise + 0.08, HOUSE.center[2]]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.12, 0.12, HOUSE.houseDepth + 1.2, 8]} />
          <meshStandardMaterial color={palette.night ? '#776477' : '#75433f'} roughness={0.85} />
        </mesh>
      </group>

      {/* string lights under the eave */}
      {lights.map((index) => {
        const x = -halfWidth + (index / (lights.length - 1)) * HOUSE.houseWidth
        const y = wallTop + 0.08
        const z = HOUSE.houseFrontZ + 0.32
        return (
          <mesh key={index} position={[x, y, z]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial
              color="#ffe9b0"
              emissive="#ffcf72"
              emissiveIntensity={palette.night ? 2.4 : 1.1}
            />
          </mesh>
        )
      })}

      <pointLight
        position={[0, wallTop + 0.4, HOUSE.center[2]]}
        intensity={palette.night ? 10 : 4}
        distance={HOUSE.houseDepth + 4}
        decay={2}
        color="#ffd9a8"
      />
    </group>
  )
}

function Fireflies({ accent }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const array = new Float32Array(36 * 3)
    for (let i = 0; i < 36; i += 1) {
      const angle = i * 2.1
      const radius = 5 + (i % 8) * 1.25
      array[i * 3] = Math.cos(angle) * radius
      array[i * 3 + 1] = 0.5 + (i % 5) * 0.35
      array[i * 3 + 2] = Math.sin(angle) * radius - 1
    }
    return array
  }, [])

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.06
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={accent} size={0.16} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}

export default function Environment({ palette }) {
  return (
    <>
      <Sky palette={palette} />
      {palette.night ? <Stars accent={palette.accent} /> : null}
      <Clouds night={palette.night} />
      <Water palette={palette} />
      <Island palette={palette} />
      <Path />
      <Pond />
      <House palette={palette} />
      {palette.night ? <Fireflies accent={palette.accent} /> : null}

      {ENVIRONMENT.map((item, index) => (
        <SafeModel
          key={`${item.asset}-${index}`}
          asset={item.asset}
          height={item.height}
          scale={item.scale ?? 1}
          position={[item.x, 0, item.z]}
          rotation={[0, item.ry ?? 0, 0]}
        />
      ))}

      {/* sun / moon */}
      <mesh position={[26, 24, -44]}>
        <sphereGeometry args={[3.4, 20, 14]} />
        <meshBasicMaterial color={palette.sun} toneMapped={false} />
      </mesh>
      <mesh position={[26, 24, -44]}>
        <sphereGeometry args={[4.8, 20, 14]} />
        <meshBasicMaterial color={palette.sun} transparent opacity={0.14} depthWrite={false} />
      </mesh>

      {/* faraway clouds below the island for depth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -9.5, 0]}>
        <circleGeometry args={[46, 28]} />
        <meshBasicMaterial color={palette.horizon} transparent opacity={0.12} depthWrite={false} side={DoubleSide} />
      </mesh>
    </>
  )
}