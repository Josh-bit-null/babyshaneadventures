import { Component, useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { Box3, Color, Group, Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { assetUrl } from '../../game/assets.js'

class AssetBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('[assets] model failed:', this.props.asset, error?.message)
  }

  render() {
    if (this.state.failed) {
      return (
        <mesh position={[0, this.props.height / 2, 0]}>
          <boxGeometry args={[0.7, this.props.height || 0.7, 0.7]} />
          <meshStandardMaterial color={this.props.tint || '#f3c9d5'} roughness={0.8} />
        </mesh>
      )
    }
    return this.props.children
  }
}

function applyTint(root, tint, glow, cloneAll = false) {
  if (!tint && !glow && !cloneAll) return []
  const tintColor = tint ? new Color(tint) : null
  const glowColor = glow ? new Color(glow) : null
  const cloned = []
  root.traverse((child) => {
    if (!(child instanceof Mesh) || !child.material) return
    const source = Array.isArray(child.material) ? child.material : [child.material]
    const materials = source.map((material) => {
      const copy = material.clone()
      if (tintColor && copy.color) copy.color.lerp(tintColor, 0.62)
      if (glowColor && copy.emissive) {
        copy.emissive.copy(glowColor)
        copy.emissiveIntensity = 0.85
      }
      copy.needsUpdate = true
      cloned.push(copy)
      return copy
    })
    child.material = Array.isArray(child.material) ? materials : materials[0]
  })
  return cloned
}

/**
 * `useLoader(GLTFLoader, assetUrl(asset))` gives us the three.js loader cache and
 * the service worker gives us the HTTP cache — heavy .glb files load once.
 */
export function Model({
  asset,
  height = 1,
  tint,
  glow,
  rotation = [0, 0, 0],
  scale = 1,
  opacity,
  ...props
}) {
  const { scene } = useLoader(GLTFLoader, assetUrl(asset))

  const { group, materials } = useMemo(() => {
    const clone = scene.clone(true)
    const measured = new Box3().setFromObject(clone)
    const size = measured.getSize(new Vector3())
    const factor = height / Math.max(0.0001, size.y)
    clone.scale.multiplyScalar(factor)
    clone.updateMatrixWorld(true)
    const scaled = new Box3().setFromObject(clone)
    const center = scaled.getCenter(new Vector3())
    clone.position.x -= center.x
    clone.position.z -= center.z
    clone.position.y -= scaled.min.y

    const wrapper = new Group()
    wrapper.add(clone)
    const clonedMaterials = applyTint(clone, tint, glow, opacity != null)
    if (opacity != null) {
      for (const material of clonedMaterials) {
        material.transparent = true
        material.opacity = opacity
        material.depthWrite = false
      }
    }
    wrapper.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false
        child.receiveShadow = false
        child.frustumCulled = true
      }
    })
    return { group: wrapper, materials: clonedMaterials }
  }, [scene, height, tint, glow, opacity])

  useEffect(() => {
    return () => {
      for (const material of materials) material.dispose?.()
    }
  }, [materials])

  return <primitive object={group} rotation={rotation} scale={scale} {...props} />
}

export function SafeModel(props) {
  return (
    <AssetBoundary asset={props.asset} tint={props.tint} height={props.height}>
      <Model {...props} />
    </AssetBoundary>
  )
}
