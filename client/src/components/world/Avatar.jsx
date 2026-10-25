import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Html, useAnimations } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { Mic, MicOff } from 'lucide-react'
import ChibiAvatar from './ChibiAvatar.jsx'
import { sampleEntity } from '../../net/interpolation.js'
import { net } from '../../net/socket.js'
import { removeRemoteAudio, setRemoteAudioPosition } from '../../game/spatialAudio.js'

class AvatarBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('[avatar] GLB failed, using chibi fallback:', error?.message)
  }

  render() {
    if (this.state.failed) {
      return <ChibiAvatar config={this.props.fallbackConfig} walkRef={this.props.walkRef} />
    }
    return this.props.children
  }
}

function GlbAvatar({ url, walkRef }) {
  const gltf = useLoader(GLTFLoader, url)
  const group = useRef()
  const normalized = useMemo(() => {
    const clone = cloneSkeleton(gltf.scene)
    const measured = new Box3().setFromObject(clone)
    const size = measured.getSize(new Vector3())
    const factor = 1.66 / Math.max(0.001, size.y)
    clone.scale.multiplyScalar(factor)
    clone.updateMatrixWorld(true)
    const scaled = new Box3().setFromObject(clone)
    clone.position.y -= scaled.min.y
    return clone
  }, [gltf.scene])
  const { actions } = useAnimations(gltf.animations, group)

  useEffect(() => {
    const idle = Object.values(actions)[0]
    idle?.reset().fadeIn(0.2).play()
    return () => idle?.fadeOut(0.2)
  }, [actions])


  return (
    <group ref={group}>
      <primitive object={normalized} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.34, 18]} />
        <meshBasicMaterial color="#5a3a46" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  )
}

function VoiceRing({ active }) {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current || !active) return
    const pulse = 0.85 + Math.sin(state.clock.elapsedTime * 3) * 0.12
    ref.current.scale.setScalar(pulse)
    ref.current.material.opacity = 0.22 + Math.sin(state.clock.elapsedTime * 3) * 0.07
  })
  if (!active) return null
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
      <ringGeometry args={[0.44, 0.56, 28]} />
      <meshBasicMaterial color="#5fd6b5" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  )
}

export function NameTag({ name, isSelf, voiceEnabled, distance, color = '#ff9ebb' }) {
  return (
    <Html
      position={[0, 2.04, 0]}
      center
      distanceFactor={11}
      zIndexRange={[30, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div className={`name-tag${isSelf ? ' name-tag-self' : ''}`}>
        <span className="name-tag-dot" style={{ background: color }} />
        <span className="name-tag-label">{name}</span>
        {isSelf ? <span className="name-tag-you">you</span> : null}
        <span className={`name-tag-mic${voiceEnabled ? ' is-live' : ''}`}>
          {voiceEnabled ? <Mic size={10} /> : <MicOff size={10} />}
        </span>
        {distance != null && !isSelf ? (
          <span className="name-tag-distance">{distance.toFixed(1)}m</span>
        ) : null}
      </div>
    </Html>
  )
}

export function AvatarFigure({ config, rpmAvatarUrl, walkRef, seed = 0 }) {
  if (rpmAvatarUrl) {
    return (
      <AvatarBoundary fallbackConfig={config} walkRef={walkRef}>
        <Suspense fallback={<ChibiAvatar config={config} walkRef={walkRef} seed={seed} />}>
          <GlbAvatar url={rpmAvatarUrl} walkRef={walkRef} />
        </Suspense>
      </AvatarBoundary>
    )
  }
  return <ChibiAvatar config={config} walkRef={walkRef} seed={seed} />
}

export function RemotePlayer({ player, selfPosition }) {
  const group = useRef()
  const walkRef = useRef(false)
  const distance = useRef(null)
  const tagRef = useRef(null)

  useEffect(() => {
    return () => removeRemoteAudio(player.id)
  }, [player.id])

  useFrame(() => {
    const sample = sampleEntity(net.getSamples(player.id), performance.now() / 1000)
    if (!sample || !group.current) {
      if (group.current) group.current.visible = false
      return
    }
    group.current.visible = true
    group.current.position.set(sample.p[0], sample.p[1], sample.p[2])
    group.current.quaternion.set(sample.q[0], sample.q[1], sample.q[2], sample.q[3])
    walkRef.current = sample.moving
    setRemoteAudioPosition(player.id, sample.p[0], sample.p[1], sample.p[2])
    if (tagRef.current && selfPosition?.current) {
      const dx = sample.p[0] - selfPosition.current[0]
      const dz = sample.p[2] - selfPosition.current[2]
      const next = Math.hypot(dx, dz)
      if (distance.current == null || Math.abs(next - distance.current) > 0.4) {
        distance.current = next
        tagRef.current.setDistance(next)
      }
    }
  })

  return (
    <group ref={group} visible={false}>
      <AvatarFigure
        config={player.avatarConfig}
        rpmAvatarUrl={player.rpmAvatarUrl}
        walkRef={walkRef}
        seed={player.id}
      />
      <VoiceRing active={player.voiceEnabled} />
      <NameTagProxy player={player} tagRef={tagRef} voiceEnabled={player.voiceEnabled} />
    </group>
  )
}

/**
 * NameTagProxy updates its label imperatively so 20Hz movement never triggers a
 * React render just for a distance readout.
 */
function NameTagProxy({ player, tagRef, voiceEnabled }) {
  const labelRef = useRef(null)
  useEffect(() => {
    tagRef.current = {
      setDistance(value) {
        if (labelRef.current) labelRef.current.textContent = `${value.toFixed(1)}m`
      },
    }
  }, [tagRef])

  return (
    <Html
      position={[0, 2.04, 0]}
      center
      distanceFactor={11}
      zIndexRange={[30, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div className="name-tag">
        <span className="name-tag-dot" style={{ background: '#ff9ebb' }} />
        <span className="name-tag-label">{player.name}</span>
        <span className={`name-tag-mic${voiceEnabled ? ' is-live' : ''}`}>
          {voiceEnabled ? <Mic size={10} /> : <MicOff size={10} />}
        </span>
        <span className="name-tag-distance" ref={labelRef} />
      </div>
    </Html>
  )
}
