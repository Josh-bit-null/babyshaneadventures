import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import ChibiAvatar from './ChibiAvatar.jsx'
import { SafeModel } from './Model.jsx'
import { defaultAvatar } from '../../game/avatar.js'

function TitleTag({ name, position }) {
  return (
    <Html position={position} center distanceFactor={7} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div className="diorama-name">{name}</div>
    </Html>
  )
}

function Island() {
  const group = useRef()
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.16
      group.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.04
    }
  })
  return (
    <group ref={group}>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[2.55, 2.35, 0.32, 12]} />
        <meshStandardMaterial color="#a6dc94" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, -0.85, 0]}>
        <cylinderGeometry args={[2.35, 1.8, 1.1, 10]} />
        <meshStandardMaterial color="#7cc178" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, -1.75, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.8, 1.2, 10]} />
        <meshStandardMaterial color="#9b8470" roughness={1} flatShading />
      </mesh>

      <group position={[0, 0, 0]}>
        <group position={[-0.68, 0, 0.1]} rotation={[0, 0.2, 0]}>
          <ChibiAvatar config={defaultAvatar('mushroom')} seed={1} />
          <TitleTag name="Mushroom Joshua" position={[0, 2.1, 0]} />
        </group>
        <group position={[0.72, 0, 0.1]} rotation={[0, -0.2, 0]}>
          <ChibiAvatar config={defaultAvatar('siopao')} seed={4} />
          <TitleTag name="Siopao RikaShane" position={[0, 2.1, 0]} />
        </group>
      </group>

      <SafeModel asset="nature/tree_default.glb" height={2.2} position={[-1.7, 0, -0.9]} />
      <SafeModel asset="nature/mushroom_red.glb" height={0.55} position={[1.55, 0, -0.7]} />
      <SafeModel asset="nature/mushroom_tan.glb" height={0.4} position={[1.2, 0, -1.0]} />
      <SafeModel asset="nature/flower_yellowA.glb" height={0.26} position={[-0.2, 0, 1.45]} />
      <SafeModel asset="nature/flower_redA.glb" height={0.26} position={[0.55, 0, 1.6]} />
      <SafeModel asset="nature/rock_smallA.glb" height={0.3} position={[1.9, 0, 0.8]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.2]}>
        <ringGeometry args={[1.72, 2.05, 28]} />
        <meshBasicMaterial color="#ffe6ee" transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

export default function LoginDiorama() {
  return (
    <div className="diorama">
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0.1, 2.25, 6.4], fov: 34, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={1.1} color="#fff3f6" />
        <hemisphereLight args={['#cbeeff', '#9bd18a', 1.2]} />
        <directionalLight position={[4, 7, 5]} intensity={1.7} color="#fff0d0" />
        <pointLight position={[-3, 2.5, 3]} intensity={3} color="#ffc5d8" distance={12} />
        <Suspense fallback={null}>
          <group position={[0, -0.5, 0]}>
            <Island />
          </group>
        </Suspense>
      </Canvas>
      <div className="diorama-glow" aria-hidden />
    </div>
  )
}
