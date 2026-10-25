import { Html, RoundedBox } from '@react-three/drei'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import Houseplant from './Houseplant.jsx'
import { HOUSE } from '../../game/assets.js'

function WorldTag({ position, icon, label, hint, onClick, tone = 'pink' }) {
  return (
    <Html
      position={position}
      center
      distanceFactor={10}
      zIndexRange={[18, 0]}
      style={{ pointerEvents: 'auto' }}
    >
      <button type="button" className={`world-tag world-tag-${tone}`} onClick={onClick}>
        <span className="world-tag-icon" aria-hidden>{icon}</span>
        <span className="world-tag-copy">
          <strong>{label}</strong>
          {hint ? <small>{hint}</small> : null}
        </span>
      </button>
    </Html>
  )
}

function ChoreBoard({ onOpen, pending }) {
  return (
    <group position={[-4.28, 1.65, -3.2]} rotation={[0, Math.PI / 2, 0]}>
      <RoundedBox args={[1.65, 1.15, 0.09]} radius={0.05} smoothness={2}>
        <meshStandardMaterial color="#b78357" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.02, 0.06]}>
        <planeGeometry args={[1.46, 0.96]} />
        <meshStandardMaterial color="#fff5e1" roughness={1} />
      </mesh>
      {[0.3, 0.08, -0.14, -0.36].map((y, index) => (
        <mesh key={index} position={[-0.06, y, 0.075]}>
          <planeGeometry args={[1.1 - index * 0.12, 0.035]} />
          <meshStandardMaterial color={index < pending ? '#e58aa4' : '#c8b49a'} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.43, 0.07]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color="#e0a94f" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <WorldTag
        position={[0, 0.94, 0.06]}
        icon="🧹"
        label="Chore board"
        hint={pending ? `${pending} awaiting a partner` : 'Pick a real-world task'}
        onClick={onOpen}
        tone="sand"
      />
    </group>
  )
}

function StudyNook({ onOpen }) {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.5
      ref.current.position.y = HOUSE.deckTop + 1.62 + Math.sin(state.clock.elapsedTime * 1.6) * 0.06
    }
  })
  return (
    <group>
      <mesh ref={ref} position={[2.2, HOUSE.deckTop + 1.62, -7.05]}>
        <octahedronGeometry args={[0.17, 0]} />
        <meshStandardMaterial
          color="#9fd8ff"
          emissive="#66b7f0"
          emissiveIntensity={1.6}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
      <pointLight position={[2.2, HOUSE.deckTop + 1.55, -7.05]} intensity={2.4} distance={3.4} color="#8fd4ff" />
      <WorldTag
        position={[2.2, HOUSE.deckTop + 2.1, -7.05]}
        icon="📖"
        label="Study nook"
        hint="Drop a PDF for ten questions"
        onClick={onOpen}
        tone="blue"
      />
    </group>
  )
}

function StoreChest({ onOpen }) {
  const lid = useRef()
  useFrame((state) => {
    if (lid.current) lid.current.rotation.x = -0.25 + Math.sin(state.clock.elapsedTime * 1.1) * 0.05
  })
  return (
    <group position={[3.72, HOUSE.deckTop, 0.95]}>
      <RoundedBox args={[0.92, 0.56, 0.66]} radius={0.06} smoothness={2} position={[0, 0.28, 0]}>
        <meshStandardMaterial color="#b07a4c" roughness={0.85} />
      </RoundedBox>
      <group ref={lid} position={[0, 0.56, -0.3]}>
        <RoundedBox args={[0.95, 0.16, 0.7]} radius={0.06} smoothness={2} position={[0, 0.05, 0.3]}>
          <meshStandardMaterial color="#c9915f" roughness={0.8} />
        </RoundedBox>
      </group>
      <mesh position={[0, 0.4, 0.34]}>
        <boxGeometry args={[0.16, 0.16, 0.04]} />
        <meshStandardMaterial color="#f0c45c" metalness={0.6} roughness={0.3} emissive="#a97a12" emissiveIntensity={0.4} />
      </mesh>
      <pointLight position={[0, 0.8, 0]} intensity={2} distance={2.6} color="#ffd88a" />
      <WorldTag
        position={[0, 1.28, 0]}
        icon="🪙"
        label="Little market"
        hint="Spend coins on your home"
        onClick={onOpen}
        tone="gold"
      />
    </group>
  )
}

function Mirror({ onOpen }) {
  return (
    <group position={[-3.95, HOUSE.deckTop, 0.95]} rotation={[0, 0.15, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.24, 0.28, 0.24, 12]} />
        <meshStandardMaterial color={HOUSE.deckTop ? '#b68a62' : '#b68a62'} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.22, 0]} scale={[0.62, 0.94, 1]}>
        <torusGeometry args={[0.52, 0.06, 8, 28]} />
        <meshStandardMaterial color="#e8bf7c" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.22, 0]} scale={[0.62, 0.94, 1]}>
        <circleGeometry args={[0.5, 28]} />
        <meshStandardMaterial color="#cfe9f2" metalness={0.9} roughness={0.12} envMapIntensity={0.4} />
      </mesh>
      <pointLight position={[0, 1.3, 0.4]} intensity={1.5} distance={2.2} color="#ffd3e2" />
      <WorldTag
        position={[0, 2.2, 0]}
        icon="🪞"
        label="Dress-up mirror"
        hint="Body, face, hair, outfit"
        onClick={onOpen}
        tone="pink"
      />
    </group>
  )
}

function FocusClock({ onOpen, status }) {
  const hands = useRef()
  useFrame((state) => {
    if (hands.current) hands.current.rotation.z = -state.clock.elapsedTime * 0.2
  })
  return (
    <group position={[0, 2.1, -8.27]}>
      <mesh>
        <circleGeometry args={[0.4, 28]} />
        <meshStandardMaterial color="#fff6e6" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <torusGeometry args={[0.42, 0.035, 6, 28]} />
        <meshStandardMaterial color="#d89a72" roughness={0.6} />
      </mesh>
      <mesh ref={hands} position={[0, 0, 0.025]}>
        <boxGeometry args={[0.025, 0.25, 0.01]} />
        <meshStandardMaterial color="#8a5a63" />
      </mesh>
      <WorldTag
        position={[0, 0.7, 0.1]}
        icon="⏳"
        label="Co-op focus"
        hint={status === 'running' ? '25 minutes locked in' : 'Start a shared 25-minute timer'}
        onClick={onOpen}
        tone="purple"
      />
    </group>
  )
}

export default function Interactables({ onOpen, chorePending, pomodoro, plantHealth }) {
  return (
    <group>
      <ChoreBoard onOpen={() => onOpen('chores')} pending={chorePending} />
      <StudyNook onOpen={() => onOpen('study')} />
      <StoreChest onOpen={() => onOpen('store')} />
      <Mirror onOpen={() => onOpen('studio')} />
      <FocusClock onOpen={() => onOpen('pomodoro')} status={pomodoro?.status} />
      <Houseplant health={plantHealth} onOpen={() => onOpen('pomodoro')} />
    </group>
  )
}
