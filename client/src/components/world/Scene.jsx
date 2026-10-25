import { Suspense, useEffect } from 'react'
import Environment from './Environment.jsx'
import Interactables from './Interactables.jsx'
import { FurnitureLayer, PlacementLayer } from './Furniture.jsx'
import PlayerController from './PlayerController.jsx'
import { RemotePlayer } from './Avatar.jsx'
import CameraRig from './CameraRig.jsx'
import { paletteFor } from '../../game/avatar.js'
import { preloadCatalog } from '../../game/assets.js'
import { getCollider } from './collision.js'

export default function Scene({
  user,
  players,
  catalog,
  room,
  inventory,
  onOpenPanel,
  placing,
  onPlace,
  onCancelPlacement,
  panelOpen,
  paused,
  selfPositionRef,
  selfId,
  voiceEnabled,
}) {
  const palette = paletteFor(catalog, room?.theme)
  const worldState = room?.worldState
  const pomodoro = worldState?.pomodoro
  const pendingChores = (worldState?.chores ?? []).filter((chore) => chore.status === 'pending').length
  const selectedUid = placing?.uid ?? null

  useEffect(() => {
    preloadCatalog(catalog)
    getCollider()
  }, [catalog])

  return (
    <>
      <fog attach="fog" args={[palette.fog, palette.night ? 18 : 26, 78]} />
      <hemisphereLight
        args={[palette.skyTop, palette.grassDeep, palette.night ? 0.65 : 1.1]}
      />
      <directionalLight
        position={[12, 17, 8]}
        intensity={palette.night ? 0.7 : 1.65}
        color={palette.sun}
      />
      <ambientLight intensity={palette.night ? 0.38 : 0.55} color={palette.ambient} />
      <directionalLight position={[-9, 8, -12]} intensity={palette.night ? 0.35 : 0.3} color={palette.accent} />

      <Suspense fallback={null}>
        <Environment palette={palette} />
        <FurnitureLayer items={inventory} catalog={catalog} selectedUid={selectedUid} />
        {placing ? (
          <PlacementLayer
            placement={placing}
            catalog={catalog}
            selectedUid={selectedUid}
            onPlace={onPlace}
          />
        ) : null}
        <Interactables
          onOpen={onOpenPanel}
          chorePending={pendingChores}
          pomodoro={pomodoro}
          plantHealth={pomodoro?.plantHealth ?? 1}
        />
        {players
          .filter((player) => player.id !== selfId)
          .map((player) => (
            <RemotePlayer key={player.id} player={player} selfPosition={selfPositionRef} />
          ))}
        <PlayerController
          user={user}
          paused={paused}
          placing={Boolean(placing)}
          voiceEnabled={voiceEnabled}
          selfPositionRef={selfPositionRef}
          selfId={selfId}
        />
      </Suspense>

      <CameraRig paused={panelOpen} />

      {import.meta.env.VITE_DEBUG_BVH === '1' ? <ColliderDebug /> : null}
    </>
  )
}

function ColliderDebug() {
  const collider = getCollider()
  return (
    <mesh geometry={collider.mesh.geometry} position={[0, 0, 0]}>
      <meshBasicMaterial color="#ff3b6b" wireframe transparent opacity={0.6} />
    </mesh>
  )
}
