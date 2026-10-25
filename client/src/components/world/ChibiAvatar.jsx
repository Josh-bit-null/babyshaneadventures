import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { Color } from 'three'
import { withDefaults } from '../../game/avatar.js'

const darken = (hex, amount = 0.72) => {
  const color = new Color(hex)
  color.multiplyScalar(amount)
  return `#${color.getHexString()}`
}


/**
 * The default entities (Mushroom Joshua / Siopao RikaShane) are built from this
 * parametric chibi rig. Ready Player Me was shut down in Jan 2026, so sex/body
 * shape, facial proportions and outfits are editable natively here; an exported
 * Ready Player Me .glb URL is still mapped into the scene by Avatar.jsx.
 */
export default function ChibiAvatar({ config: rawConfig, walkRef, seed = 0 }) {
  const config = useMemo(() => withDefaults(rawConfig), [rawConfig])
  const bodyRef = useRef()
  const armL = useRef()
  const armR = useRef()
  const legL = useRef()
  const legR = useRef()
  const eyeL = useRef()
  const eyeR = useRef()
  const headRef = useRef()

  const outfitDark = useMemo(() => darken(config.outfitColor, 0.68), [config.outfitColor])
  const outfitLight = useMemo(() => darken(config.outfitColor, 0.88), [config.outfitColor])
  const skinShade = useMemo(() => darken(config.skinTone, 0.88), [config.skinTone])

  const shoulder = config.body === 'masculine' ? 1.13 : config.body === 'feminine' ? 0.98 : 1.05
  const hip = config.body === 'feminine' ? 1.1 : config.body === 'masculine' ? 0.96 : 1.02
  const isDress = config.outfitStyle === 'dress'
  const eyeSpacing = 0.125 * config.eyeSpacing
  const eyeZ = 0.325

  useFrame((state) => {
    const t = state.clock.elapsedTime + seed * 2.7
    const walking = Boolean(walkRef?.current)
    const swing = walking ? Math.sin(t * 10.5) : Math.sin(t * 1.8) * 0.08
    const legSwing = walking ? Math.sin(t * 10.5) * 0.72 : 0
    if (armL.current) armL.current.rotation.x = swing * 0.68
    if (armR.current) armR.current.rotation.x = -swing * 0.68
    if (legL.current) legL.current.rotation.x = legSwing
    if (legR.current) legR.current.rotation.x = -legSwing
    if (bodyRef.current) {
      bodyRef.current.position.y = walking
        ? Math.abs(Math.sin(t * 10.5)) * 0.035
        : Math.sin(t * 1.7) * 0.012
      bodyRef.current.rotation.z = walking ? Math.sin(t * 5.2) * 0.03 : Math.sin(t * 1.2) * 0.012
    }
    if (headRef.current) {
      headRef.current.rotation.z = walking ? Math.sin(t * 5.2) * 0.035 : Math.sin(t * 0.9) * 0.02
      headRef.current.rotation.x = walking ? -0.04 : 0.01
    }
    const blinkPhase = (t + 1.7) % 4.6
    const blink = blinkPhase > 4.38 ? 0.12 : 1
    if (eyeL.current) eyeL.current.scale.y = config.eyeSize * blink
    if (eyeR.current) eyeR.current.scale.y = config.eyeSize * blink
  })

  return (
    <group scale={config.height}>
      {/* soft blob shadow, cheap on mobile */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <circleGeometry args={[0.34, 18]} />
        <meshBasicMaterial color="#5a3a46" transparent opacity={0.18} depthWrite={false} />
      </mesh>

      <group ref={bodyRef}>
        {/* legs */}
        <group ref={legL} position={[-0.125, 0.56, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow={false}>
            <capsuleGeometry args={[0.09, 0.28, 4, 8]} />
            <meshStandardMaterial color={outfitDark} roughness={0.85} />
          </mesh>
          <RoundedBox args={[0.17, 0.12, 0.27]} radius={0.05} smoothness={2} position={[0, -0.42, 0.055]}>
            <meshStandardMaterial color={outfitDark} roughness={0.9} />
          </RoundedBox>
        </group>
        <group ref={legR} position={[0.125, 0.56, 0]}>
          <mesh position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.09, 0.28, 4, 8]} />
            <meshStandardMaterial color={outfitDark} roughness={0.85} />
          </mesh>
          <RoundedBox args={[0.17, 0.12, 0.27]} radius={0.05} smoothness={2} position={[0, -0.42, 0.055]}>
            <meshStandardMaterial color={outfitDark} roughness={0.9} />
          </RoundedBox>
        </group>

        {/* hips / skirt */}
        {isDress ? (
          <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.255, 0.43 * hip, 0.4, 14]} />
            <meshStandardMaterial color={config.outfitColor} roughness={0.9} />
          </mesh>
        ) : (
          <RoundedBox
            args={[0.43 * hip, 0.24, 0.3]}
            radius={0.07}
            smoothness={2}
            position={[0, 0.64, 0]}
          >
            <meshStandardMaterial color={outfitDark} roughness={0.88} />
          </RoundedBox>
        )}

        {/* torso */}
        <RoundedBox
          args={[0.5 * shoulder, 0.52, 0.31]}
          radius={0.12}
          smoothness={3}
          position={[0, 0.95, 0]}
        >
          <meshStandardMaterial color={config.outfitColor} roughness={0.86} />
        </RoundedBox>

        {config.outfitStyle === 'hoodie' ? (
          <>
            <mesh position={[0, 1.16, -0.16]} rotation={[0.35, 0, 0]}>
              <torusGeometry args={[0.19, 0.055, 7, 14, Math.PI]} />
              <meshStandardMaterial color={outfitLight} roughness={0.9} />
            </mesh>
            <RoundedBox args={[0.24, 0.11, 0.025]} radius={0.02} position={[0, 0.8, 0.165]}>
              <meshStandardMaterial color={outfitDark} roughness={0.9} />
            </RoundedBox>
          </>
        ) : null}

        {config.outfitStyle === 'overalls' ? (
          <>
            <RoundedBox args={[0.12, 0.38, 0.03]} radius={0.015} position={[-0.12, 1.06, 0.165]}>
              <meshStandardMaterial color={outfitDark} roughness={0.9} />
            </RoundedBox>
            <RoundedBox args={[0.12, 0.38, 0.03]} radius={0.015} position={[0.12, 1.06, 0.165]}>
              <meshStandardMaterial color={outfitDark} roughness={0.9} />
            </RoundedBox>
            <RoundedBox args={[0.24, 0.16, 0.025]} radius={0.02} position={[0, 0.88, 0.17]}>
              <meshStandardMaterial color={outfitLight} roughness={0.9} />
            </RoundedBox>
          </>
        ) : null}

        {config.outfitStyle === 'tee' ? (
          <mesh position={[0, 1.1, 0.02]}>
            <torusGeometry args={[0.12, 0.018, 6, 16]} />
            <meshStandardMaterial color={outfitLight} roughness={0.9} />
          </mesh>
        ) : null}

        {/* arms */}
        <group ref={armL} position={[-0.3 * shoulder, 1.06, 0]}>
          <mesh position={[0, -0.17, 0]}>
            <capsuleGeometry args={[0.072, 0.24, 4, 8]} />
            <meshStandardMaterial color={config.outfitStyle === 'dress' ? config.skinTone : config.outfitColor} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.34, 0]}>
            <sphereGeometry args={[0.077, 12, 10]} />
            <meshStandardMaterial color={config.skinTone} roughness={0.8} />
          </mesh>
        </group>
        <group ref={armR} position={[0.3 * shoulder, 1.06, 0]}>
          <mesh position={[0, -0.17, 0]}>
            <capsuleGeometry args={[0.072, 0.24, 4, 8]} />
            <meshStandardMaterial color={config.outfitStyle === 'dress' ? config.skinTone : config.outfitColor} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.34, 0]}>
            <sphereGeometry args={[0.077, 12, 10]} />
            <meshStandardMaterial color={config.skinTone} roughness={0.8} />
          </mesh>
        </group>

        {/* neck + head */}
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.09, 0.1, 0.1, 10]} />
          <meshStandardMaterial color={skinShade} roughness={0.8} />
        </mesh>

        <group ref={headRef}>
          <mesh position={[0, 1.36, 0]} scale={[1.04, 0.99, 1]}>
            <sphereGeometry args={[0.35, 24, 18]} />
            <meshStandardMaterial color={config.skinTone} roughness={0.72} />
          </mesh>
          <mesh position={[-0.345, 1.35, 0]}>
            <sphereGeometry args={[0.065, 10, 8]} />
            <meshStandardMaterial color={config.skinTone} roughness={0.8} />
          </mesh>
          <mesh position={[0.345, 1.35, 0]}>
            <sphereGeometry args={[0.065, 10, 8]} />
            <meshStandardMaterial color={config.skinTone} roughness={0.8} />
          </mesh>

          {/* eyes */}
          <group ref={eyeL} position={[-eyeSpacing, 1.39, eyeZ]} scale={[config.eyeSize, config.eyeSize, 1]}>
            <mesh scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.075, 14, 12]} />
              <meshStandardMaterial color="#fffaf6" roughness={0.35} />
            </mesh>
            <mesh position={[0, -0.005, 0.045]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.046, 12, 10]} />
              <meshStandardMaterial color={config.eyeColor} roughness={0.3} />
            </mesh>
            <mesh position={[0.015, 0.02, 0.07]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
          <group ref={eyeR} position={[eyeSpacing, 1.39, eyeZ]} scale={[config.eyeSize, config.eyeSize, 1]}>
            <mesh scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.075, 14, 12]} />
              <meshStandardMaterial color="#fffaf6" roughness={0.35} />
            </mesh>
            <mesh position={[0, -0.005, 0.045]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.046, 12, 10]} />
              <meshStandardMaterial color={config.eyeColor} roughness={0.3} />
            </mesh>
            <mesh position={[0.013, 0.02, 0.07]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>

          {/* brows */}
          <mesh position={[-eyeSpacing, 1.5, 0.325]} rotation={[0, 0, 0.12]}>
            <boxGeometry args={[0.09, 0.017, 0.015]} />
            <meshStandardMaterial color={config.hairColor} roughness={0.8} />
          </mesh>
          <mesh position={[eyeSpacing, 1.5, 0.325]} rotation={[0, 0, -0.12]}>
            <boxGeometry args={[0.09, 0.017, 0.015]} />
            <meshStandardMaterial color={config.hairColor} roughness={0.8} />
          </mesh>

          {/* smile */}
          <mesh
            position={[0, 1.205, 0.336]}
            rotation={[0, 0, Math.PI]}
            scale={[0.85 + config.smile * 0.35, 0.55 + config.smile * 0.5, 1]}
          >
            <torusGeometry args={[0.063, 0.012, 6, 16, Math.PI]} />
            <meshStandardMaterial color="#8a4b57" roughness={0.5} />
          </mesh>

          {config.accessory === 'blush' ? (
            <>
              <mesh position={[-0.23, 1.29, 0.33]} scale={[1, 0.6, 1]}>
                <circleGeometry args={[0.055, 12]} />
                <meshBasicMaterial color="#ff9fb4" transparent opacity={0.65} />
              </mesh>
              <mesh position={[0.23, 1.29, 0.33]} scale={[1, 0.6, 1]}>
                <circleGeometry args={[0.055, 12]} />
                <meshBasicMaterial color="#ff9fb4" transparent opacity={0.65} />
              </mesh>
            </>
          ) : null}

          {config.accessory === 'glasses' ? (
            <group position={[0, 1.39, 0.345]}>
              <mesh position={[-eyeSpacing, 0, 0]}>
                <torusGeometry args={[0.085, 0.012, 6, 16]} />
                <meshStandardMaterial color="#3b3038" roughness={0.4} metalness={0.3} />
              </mesh>
              <mesh position={[eyeSpacing, 0, 0]}>
                <torusGeometry args={[0.085, 0.012, 6, 16]} />
                <meshStandardMaterial color="#3b3038" roughness={0.4} metalness={0.3} />
              </mesh>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.09, 0.012, 0.012]} />
                <meshStandardMaterial color="#3b3038" roughness={0.4} />
              </mesh>
            </group>
          ) : null}

          {config.accessory === 'headphones' ? (
            <group>
              <mesh position={[0, 1.46, 0]} rotation={[0, 0, 0]}>
                <torusGeometry args={[0.38, 0.028, 6, 20, Math.PI]} />
                <meshStandardMaterial color="#4c4552" roughness={0.5} metalness={0.2} />
              </mesh>
              <mesh position={[-0.37, 1.34, 0]}>
                <sphereGeometry args={[0.08, 12, 10]} />
                <meshStandardMaterial color="#4c4552" roughness={0.6} />
              </mesh>
              <mesh position={[0.37, 1.34, 0]}>
                <sphereGeometry args={[0.08, 12, 10]} />
                <meshStandardMaterial color="#4c4552" roughness={0.6} />
              </mesh>
            </group>
          ) : null}

          {/* hair */}
          <mesh position={[0, 1.38, -0.015]} scale={[1.02, 1, 1.02]}>
            <sphereGeometry args={[0.372, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            <meshStandardMaterial color={config.hairColor} roughness={0.82} />
          </mesh>
          <mesh position={[0, 1.49, 0.27]} scale={[1, 0.4, 0.55]}>
            <sphereGeometry args={[0.17, 12, 10]} />
            <meshStandardMaterial color={config.hairColor} roughness={0.82} />
          </mesh>

          {config.hairStyle === 'bob' ? (
            <>
              <RoundedBox args={[0.14, 0.5, 0.28]} radius={0.06} position={[-0.31, 1.23, -0.01]}>
                <meshStandardMaterial color={config.hairColor} roughness={0.82} />
              </RoundedBox>
              <RoundedBox args={[0.14, 0.5, 0.28]} radius={0.06} position={[0.31, 1.23, -0.01]}>
                <meshStandardMaterial color={config.hairColor} roughness={0.82} />
              </RoundedBox>
              <RoundedBox args={[0.48, 0.3, 0.16]} radius={0.06} position={[0, 1.2, -0.29]}>
                <meshStandardMaterial color={config.hairColor} roughness={0.82} />
              </RoundedBox>
            </>
          ) : null}

          {config.hairStyle === 'buns' ? (
            <>
              <mesh position={[-0.27, 1.66, -0.04]}>
                <sphereGeometry args={[0.135, 14, 12]} />
                <meshStandardMaterial color={config.hairColor} roughness={0.8} />
              </mesh>
              <mesh position={[0.27, 1.66, -0.04]}>
                <sphereGeometry args={[0.135, 14, 12]} />
                <meshStandardMaterial color={config.hairColor} roughness={0.8} />
              </mesh>
            </>
          ) : null}

          {config.hairStyle === 'long' ? (
            <RoundedBox args={[0.5, 0.76, 0.18]} radius={0.08} position={[0, 1.05, -0.27]}>
              <meshStandardMaterial color={config.hairColor} roughness={0.82} />
            </RoundedBox>
          ) : null}

          {config.hairStyle === 'spiky'
            ? [
                [-0.18, 1.66, 0.02],
                [0, 1.72, 0.06],
                [0.18, 1.66, 0.02],
                [-0.08, 1.69, -0.15],
                [0.1, 1.68, -0.16],
              ].map((position, index) => (
                <mesh key={index} position={position} rotation={[0.2, 0, (index - 2) * 0.28]}>
                  <coneGeometry args={[0.08, 0.22, 6]} />
                  <meshStandardMaterial color={config.hairColor} roughness={0.82} />
                </mesh>
              ))
            : null}

          {config.hairStyle === 'curly'
            ? [
                [-0.3, 1.58, 0.02],
                [0.3, 1.58, 0.02],
                [-0.2, 1.69, -0.12],
                [0.2, 1.69, -0.12],
                [0, 1.73, -0.02],
                [-0.32, 1.42, -0.16],
                [0.32, 1.42, -0.16],
              ].map((position, index) => (
                <mesh key={index} position={position}>
                  <sphereGeometry args={[0.11, 10, 8]} />
                  <meshStandardMaterial color={config.hairColor} roughness={0.85} />
                </mesh>
              ))
            : null}

          {/* hats */}
          {config.hat === 'mushroom' ? (
            <group position={[0, 1.57, 0]}>
              <mesh scale={[1, 0.62, 1]} position={[0, 0.13, 0]}>
                <sphereGeometry args={[0.46, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                <meshStandardMaterial color="#e05a5a" roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.2, 0.24, 0.16, 14]} />
                <meshStandardMaterial color="#f6e6cf" roughness={0.85} />
              </mesh>
              {[
                [-0.24, 0.22, 0.16],
                [0.2, 0.24, 0.1],
                [0.02, 0.27, -0.16],
                [-0.12, 0.18, 0.29],
                [0.31, 0.15, 0.18],
              ].map((position, index) => (
                <mesh key={index} position={position} scale={[1, 0.35, 1]}>
                  <sphereGeometry args={[0.052, 10, 8]} />
                  <meshStandardMaterial color="#fff5e6" roughness={0.7} />
                </mesh>
              ))}
            </group>
          ) : null}

          {config.hat === 'siopao' ? (
            <group position={[0, 1.62, 0]}>
              <mesh position={[-0.22, 0.06, -0.02]}>
                <sphereGeometry args={[0.18, 16, 12]} />
                <meshStandardMaterial color="#fff4e4" roughness={0.9} />
              </mesh>
              <mesh position={[0.22, 0.06, -0.02]}>
                <sphereGeometry args={[0.18, 16, 12]} />
                <meshStandardMaterial color="#fff4e4" roughness={0.9} />
              </mesh>
              <mesh position={[-0.22, 0.2, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.045, 0.012, 5, 10]} />
                <meshStandardMaterial color="#f3c9d5" roughness={0.8} />
              </mesh>
              <mesh position={[0.22, 0.2, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.045, 0.012, 5, 10]} />
                <meshStandardMaterial color="#f3c9d5" roughness={0.8} />
              </mesh>
            </group>
          ) : null}

          {config.hat === 'beanie' ? (
            <group position={[0, 1.55, 0]}>
              <mesh position={[0, 0.08, 0]} scale={[1, 0.8, 1]}>
                <sphereGeometry args={[0.385, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                <meshStandardMaterial color={config.outfitColor} roughness={0.9} />
              </mesh>
              <mesh position={[0, -0.02, 0]}>
                <cylinderGeometry args={[0.385, 0.385, 0.09, 18]} />
                <meshStandardMaterial color={outfitLight} roughness={0.9} />
              </mesh>
            </group>
          ) : null}
        </group>
      </group>
    </group>
  )
}
