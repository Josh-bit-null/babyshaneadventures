import { Component, Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { ACESFilmicToneMapping } from 'three'
import Scene from './Scene.jsx'
import { isMobileDevice, supportsWebGL } from '../../lib/device.js'

class CanvasBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('[world] canvas failed:', error)
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="webgl-fallback">
          <span>🫧</span>
          <h2>The 3D island could not start.</h2>
          <p>Try closing other tabs or enabling hardware acceleration, then reload.</p>
        </div>
      )
    }
    return this.props.children
  }
}

function LoadingVeil() {
  const { active, progress, loaded } = useProgress()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!active && loaded > 0) {
      const timer = setTimeout(() => setHidden(true), 450)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [active, loaded])

  if (hidden) return null
  return (
    <div className={`world-loading${active ? '' : ' is-finishing'}`}>
      <div className="world-loading-card">
        <div className="world-loading-orbit">
          <span>🍄</span>
        </div>
        <strong>Building the island…</strong>
        <div className="world-loading-bar">
          <div style={{ width: `${Math.max(4, progress)}%` }} />
        </div>
        <small>{loaded} low-poly pieces from the CC0 packs</small>
      </div>
    </div>
  )
}

export default function WorldCanvas(props) {
  if (!supportsWebGL) {
    return (
      <div className="webgl-fallback">
        <span>🪴</span>
        <h2>This browser cannot draw the 3D island.</h2>
        <p>Enable WebGL to explore, or open BabyShane in a modern browser.</p>
      </div>
    )
  }

  return (
    <CanvasBoundary>
      <div className="world-canvas">
        <Canvas
          dpr={isMobileDevice ? [1, 1.55] : [1, 1.9]}
          shadows={false}
          flat
          camera={{ position: [0, 6.2, 12.6], fov: 48, near: 0.08, far: 160 }}
          gl={{
            antialias: isMobileDevice,
            alpha: true,
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = ACESFilmicToneMapping
            gl.toneMappingExposure = 1.04
          }}
        >
          <Suspense fallback={null}>
            <Scene {...props} />
          </Suspense>
          <LoadingVeilGuard />
        </Canvas>
        <LoadingVeil />
      </div>
    </CanvasBoundary>
  )
}

function LoadingVeilGuard() {
  // Keeps Suspense state subscribed without rendering DOM inside WebGL.
  useProgress()
  return null
}