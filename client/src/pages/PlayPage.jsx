import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  FileText,
  Loader2,
  LogOut,
  RefreshCw,
  RotateCcw,
  Sprout,
  WifiOff,
  X,
} from 'lucide-react'
import Hud from '../components/ui/Hud.jsx'
import Joystick from '../components/ui/Joystick.jsx'
import StorePanel from '../components/ui/StorePanel.jsx'
import StudyPanel from '../components/ui/StudyPanel.jsx'
import ScreenTimePanel from '../components/ui/ScreenTimePanel.jsx'
import PomodoroPanel from '../components/ui/PomodoroPanel.jsx'
import ChorePanel from '../components/ui/ChorePanel.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { api } from '../lib/api.js'
import { net } from '../net/socket.js'
import { isMobileDevice } from '../lib/device.js'
import { useKeyboardInput } from '../game/input.js'
import { localState } from '../game/state.js'
import { useSpatialVoice } from '../game/useSpatialVoice.js'

const SPACING = 1000 / 20
const AvatarStudio = lazy(() => import('../components/ui/AvatarStudio.jsx'))
const WorldCanvas = lazy(() => import('../components/world/WorldCanvas.jsx'))

export default function PlayPage({ initialPanel = null }) {
  const { user, roomId, setCoins, logout } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = isMobileDevice

  const [world, setWorld] = useState(null)
  const [players, setPlayers] = useState([])
  const [selfId, setSelfId] = useState(null)
  const [connection, setConnection] = useState('connecting')
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState('')
  const [panel, setPanel] = useState(initialPanel)
  const [placing, setPlacing] = useState(null)
  const [placingBusy, setPlacingBusy] = useState(false)
  const [focusBroken, setFocusBroken] = useState(false)
  const [sessionReplaced, setSessionReplaced] = useState(false)
  const [incomingPdf, setIncomingPdf] = useState(null)
  const [draggingPdf, setDraggingPdf] = useState(false)
  const [reconnectingHere, setReconnectingHere] = useState(false)
  const selfPositionRef = useRef([0, 0, 3.6])
  const voiceErrorShown = useRef(false)

  const room = world?.room
  const inventory = world?.inventory ?? []
  const catalog = world?.catalog
  const paused = Boolean(panel) || Boolean(placing) || focusBroken || sessionReplaced

  useKeyboardInput({ enabled: !panel && !placing && !focusBroken && !sessionReplaced })

  const voice = useSpatialVoice({ players, selfId: selfId ?? -1 })

  const refreshWorld = useCallback(async () => {
    try {
      const data = await api.get(`/api/world/${roomId}`)
      setWorld({ room: data.room, inventory: data.inventory, catalog: data.catalog })
      setCoins(data.user.coins)
      return data
    } catch (error) {
      console.warn('[world] refresh failed:', error.message)
      return null
    }
  }, [roomId, setCoins])

  const applyJoin = useCallback((ack) => {
    if (!ack?.ok) return
    setSelfId(ack.self.id)
    setPlayers(ack.players)
    setWorld((current) =>
      current
        ? { ...current, room: ack.room, inventory: ack.inventory }
        : current,
    )
    setConnection('online')
    if (!localState.ready && Array.isArray(ack.self.p)) {
      localState.p = [...ack.self.p]
      localState.q = Array.isArray(ack.self.q) ? [...ack.self.q] : [0, 0, 0, 1]
      localState.yaw = 2 * Math.atan2(localState.q[1], localState.q[3])
      localState.ready = true
      selfPositionRef.current = [...localState.p]
    }
  }, [])

  // Socket event wiring (registered before the first connect).
  useEffect(() => {
    const offs = [
      net.on('room:joined', applyJoin),
      net.on('room:players', (payload) => setPlayers(payload.players)),
      net.on('world:update', (payload) => {
        setWorld((current) =>
          current
            ? { ...current, room: payload.room, inventory: payload.inventory }
            : current,
        )
      }),
      net.on('coins:update', ({ coins }) => setCoins(coins)),
      net.on('pomodoro:started', (payload) => {
        setWorld((current) =>
          current && payload?.worldState
            ? { ...current, room: { ...current.room, worldState: payload.worldState } }
            : current,
        )
        if (payload?.message) push({ type: 'info', message: payload.message, icon: '⏳' })
      }),
      net.on('pomodoro:failed', (payload) => {
        setWorld((current) =>
          current && payload?.worldState
            ? { ...current, room: { ...current.room, worldState: payload.worldState } }
            : current,
        )
        push({
          type: 'error',
          title: 'Focus broken',
          message: payload?.message || 'Sprout wilted.',
          icon: '🥀',
        })
      }),
      net.on('pomodoro:complete', (payload) => {
        setWorld((current) =>
          current && payload?.worldState
            ? { ...current, room: { ...current.room, worldState: payload.worldState } }
            : current,
        )
        push({
          type: 'reward',
          title: 'Focus complete',
          message: payload?.message || '25 minutes done. Sprout is thriving.',
          icon: '🌱',
        })
      }),
      net.on('chore:update', (payload) => {
        setWorld((current) =>
          current && payload?.worldState
            ? { ...current, room: { ...current.room, worldState: payload.worldState } }
            : current,
        )
        if (payload?.message) push({ type: 'info', message: payload.message, icon: '🧹' })
      }),
      net.on('chore:verified', (payload) => {
        setWorld((current) =>
          current && payload?.worldState
            ? { ...current, room: { ...current.room, worldState: payload.worldState } }
            : current,
        )
        push({
          type: 'reward',
          title: 'Rare drop!',
          message: payload?.message || 'A rare piece joined your shared inventory.',
          icon: payload?.reward?.icon || '💎',
        })
        refreshWorld()
      }),
      net.on('presence:toast', (payload) => {
        push({ type: 'info', message: payload?.message, icon: payload?.type === 'join' ? '👋' : '🚶' })
      }),
      net.on('session:replaced', (payload) => {
        net.disconnect()
        setSessionReplaced(true)
        setConnection('offline')
        push({ type: 'error', message: payload?.message || 'This account opened on another tab.' })
      }),
      net.on('connection:open', () => setConnection('connecting')),
      net.on('connection:restored', () => {
        setConnection('online')
        push({ type: 'success', title: 'Back online', message: 'Rejoined the island.', icon: '🌿' })
        refreshWorld()
      }),
      net.on('connection:closed', ({ reason }) => {
        if (reason === 'io client disconnect') return
        if (focusBroken || sessionReplaced) return
        setConnection('reconnecting')
      }),
      net.on('connect:error', ({ message }) => {
        if (/unauthorized/i.test(message)) {
          push({ type: 'error', message: 'Session expired. Sign in again.' })
          setFatal('Your session expired. Please sign in again.')
        } else {
          setConnection('reconnecting')
        }
      }),
      net.on('room:error', ({ message }) => {
        push({ type: 'error', message })
      }),
    ]
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyJoin, refreshWorld])

  // Boot: fetch the room snapshot, then open the authenticated socket.
  useEffect(() => {
    let alive = true
    localState.ready = false
    setLoading(true)
    setFatal('')
    async function boot() {
      try {
        const data = await api.get(`/api/world/${roomId}`)
        if (!alive) return
        setWorld({ room: data.room, inventory: data.inventory, catalog: data.catalog })
        setCoins(data.user.coins)
        setLoading(false)
        await net.connect(roomId)
        if (!alive) return
        setConnection('online')
      } catch (error) {
        if (!alive) return
        setLoading(false)
        setConnection('offline')
        setFatal(error.message)
      }
    }
    boot()
    return () => {
      alive = false
      net.disconnect()
      localState.ready = false
      voice.stop?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // 20 Hz transform uplink.
  useEffect(() => {
    if (!world || focusBroken || sessionReplaced) return undefined
    const send = () => {
      if (!net.connected || !localState.ready) return
      net.emit('player:state', {
        p: localState.p,
        q: localState.q,
        moving: localState.moving,
      })
    }
    const timer = setInterval(send, SPACING)
    return () => clearInterval(timer)
  }, [world, focusBroken, sessionReplaced])

  // Page Visibility polling for the shared focus timer.
  const pomodoroStatus = room?.worldState?.pomodoro?.status
  useEffect(() => {
    if (pomodoroStatus !== 'running' || focusBroken) return undefined
    let fired = false
    const check = () => {
      if (fired || document.visibilityState !== 'hidden') return
      fired = true
      net.emit('pomodoro:distracted', { reason: 'hidden' })
      window.setTimeout(() => {
        net.disconnect()
        setConnection('offline')
        setFocusBroken(true)
      }, 220)
    }
    const timer = setInterval(check, 500)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [pomodoroStatus, focusBroken])

  // Refresh once when returning to a visible tab (unless a focus break is shown).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !focusBroken) refreshWorld()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshWorld, focusBroken])

  // Global PDF drop on the 3D canvas.
  useEffect(() => {
    const onDragOver = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return
      event.preventDefault()
      setDraggingPdf(true)
    }
    const onDragLeave = (event) => {
      if (event.relatedTarget === null) setDraggingPdf(false)
    }
    const onDrop = (event) => {
      if (event.defaultPrevented) return
      event.preventDefault()
      setDraggingPdf(false)
      const file = [...(event.dataTransfer?.files ?? [])].find(
        (entry) => entry.type === 'application/pdf' || /\.pdf$/i.test(entry.name),
      )
      if (!file) {
        push({ type: 'info', message: 'Only PDF files become quizzes. Drop a syllabus or slide deck.', icon: '📄' })
        return
      }
      setIncomingPdf(file)
      setPanel('study')
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [push])

  // Escape cancels placement.
  useEffect(() => {
    if (!placing) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setPlacing(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [placing])

  useEffect(() => {
    if (voice.error && !voiceErrorShown.current) {
      voiceErrorShown.current = true
      push({ type: 'error', title: 'Voice unavailable', message: voice.error, icon: '🎙️' })
    }
  }, [voice.error, push])

  const openPanel = (id) => {
    setPlacing(null)
    setPanel(id)
  }

  const closePanel = () => setPanel(null)

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      push({ type: 'success', title: 'Room code copied', message: `Send “${roomId}” to your partner.`, icon: '🔗' })
    } catch {
      push({ type: 'info', message: `Room code: ${roomId}` })
    }
  }

  const handleLogout = async () => {
    voice.stop()
    net.disconnect()
    await logout()
    navigate('/login', { replace: true })
  }

  const startMove = (item) => {
    setPlacing(item)
    setPanel(null)
  }

  const placeItem = async (point) => {
    if (!placing) return
    setPlacingBusy(true)
    try {
      const response = await api.patch(`/api/inventory/items/${placing.uid}`, {
        roomId,
        ...point,
      })
      setWorld((current) => (current ? { ...current, inventory: response.inventory } : current))
      setPlacing(null)
      push({ type: 'success', message: 'Moved. Saved to the room’s coordinate grid.', icon: '📍' })
    } catch (error) {
      push({ type: 'error', message: error.message })
    } finally {
      setPlacingBusy(false)
    }
  }

  const reconnectAfterBreak = async () => {
    setReconnectingHere(true)
    setFocusBroken(false)
    setConnection('connecting')
    try {
      await net.connect(roomId)
      await refreshWorld()
      setPanel('pomodoro')
      push({
        type: 'info',
        title: 'Back on the island',
        message: 'Sprout is still wilted. Start a fresh 25-minute session to revive it.',
        icon: '🌱',
      })
    } catch (error) {
      push({ type: 'error', message: error.message })
      setFocusBroken(true)
      setConnection('offline')
    } finally {
      setReconnectingHere(false)
    }
  }

  const takeBackSession = async () => {
    setReconnectingHere(true)
    setSessionReplaced(false)
    setConnection('connecting')
    try {
      await net.connect(roomId)
      await refreshWorld()
      push({ type: 'success', message: 'This tab owns the session again.' })
    } catch (error) {
      push({ type: 'error', message: error.message })
      setSessionReplaced(true)
    } finally {
      setReconnectingHere(false)
    }
  }

  if (loading || (!world && !fatal)) {
    return (
      <div className="play-loading">
        <span className="play-loading-bun">🍄</span>
        <strong>Opening room “{roomId}”…</strong>
        <p>Loading the shared furniture and low-poly island.</p>
        <div className="play-loading-bar"><span /></div>
      </div>
    )
  }

  if (fatal || !world) {
    return (
      <div className="fatal">
        <div className="fatal-card">
          <span className="fatal-emoji">🌧️</span>
          <h1>The island is out of reach.</h1>
          <p>{fatal || 'The room could not be loaded.'}</p>
          <div className="fatal-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  const voiceEnabled = voice.status === 'on'

  return (
    <div className={`play-page${isMobile ? ' is-mobile' : ''}`}>
      <Suspense
        fallback={
          <div className="world-loading">
            <div className="world-loading-card">
              <div className="world-loading-orbit"><span>🍄</span></div>
              <strong>Preparing the island…</strong>
            </div>
          </div>
        }
      >
        <WorldCanvas
          user={{ ...user, avatarConfig: user.avatarConfig }}
          players={players}
          catalog={catalog}
          room={room}
          inventory={inventory}
          onOpenPanel={openPanel}
          placing={placing}
          onPlace={placeItem}
          onCancelPlacement={() => setPlacing(null)}
          panelOpen={paused}
          paused={paused}
          selfPositionRef={selfPositionRef}
          selfId={selfId}
          voiceEnabled={voiceEnabled}
        />
      </Suspense>

      <Hud
        user={user}
        roomId={roomId}
        players={players}
        coins={user.coins}
        connection={connection}
        pomodoro={room.worldState.pomodoro}
        plantHealth={room.worldState.pomodoro?.plantHealth ?? 1}
        onOpen={openPanel}
        onCopyRoom={copyRoom}
        onLogout={handleLogout}
        voice={voice}
        isMobile={isMobile}
      />

      {isMobile ? (
        <Joystick disabled={paused} />
      ) : null}

      {placing ? (
        <div className="placement-bar">
          <span className="placement-icon">{catalog.items.find((entry) => entry.sku === placing.sku)?.icon ?? '🪑'}</span>
          <div>
            <strong>Move {catalog.items.find((entry) => entry.sku === placing.sku)?.name ?? 'furniture'}</strong>
            <small>{placingBusy ? 'Saving coordinates…' : 'Tap the island to place · Esc to cancel'}</small>
          </div>
          <button type="button" className="icon-btn" onClick={() => setPlacing(null)} aria-label="Cancel placement">
            <X size={16} />
          </button>
        </div>
      ) : null}

      {draggingPdf ? (
        <div className="pdf-drag-overlay">
          <div>
            <FileText size={34} />
            <strong>Drop that PDF on the island</strong>
            <p>pdf.js extracts the text locally, Gemini writes ten questions.</p>
          </div>
        </div>
      ) : null}

      {focusBroken ? (
        <div className="blocking-overlay">
          <div className="blocking-card focus-break-card">
            <span className="blocking-emoji">🥀</span>
            <p className="eyebrow"><Sprout size={13} /> Focus broken</p>
            <h2>You left the tab.</h2>
            <p>
              The co-op timer was locked for 25 minutes. Hiding the tab broke the
              connection, so Sprout wilted and the room was notified.
            </p>
            <button type="button" className="btn btn-primary btn-lg" onClick={reconnectAfterBreak} disabled={reconnectingHere}>
              {reconnectingHere ? <Loader2 className="spin" size={17} /> : <RotateCcw size={17} />}
              Return to the island
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      ) : null}

      {sessionReplaced ? (
        <div className="blocking-overlay">
          <div className="blocking-card">
            <span className="blocking-emoji">🪞</span>
            <p className="eyebrow"><WifiOff size={13} /> Session replaced</p>
            <h2>This account is open in another tab.</h2>
            <p>
              Only one avatar per account can exist in the room, so the duplicate was
              disconnected. Take the session back here, or sign out.
            </p>
            <button type="button" className="btn btn-primary" onClick={takeBackSession} disabled={reconnectingHere}>
              {reconnectingHere ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
              Use this tab
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'store' ? (
        <StorePanel
          catalog={catalog}
          inventory={inventory}
          room={room}
          onClose={closePanel}
          onMove={startMove}
          onRefreshWorld={refreshWorld}
          fullPage={initialPanel === 'store' || location.pathname === '/store'}
        />
      ) : null}

      {panel === 'study' ? (
        <StudyPanel
          onClose={closePanel}
          incomingFile={incomingPdf}
          onConsumed={() => setIncomingPdf(null)}
        />
      ) : null}

      {panel === 'screentime' ? (
        <ScreenTimePanel
          onClose={closePanel}
          room={room}
          players={players}
          onRefreshWorld={refreshWorld}
        />
      ) : null}

      {panel === 'pomodoro' ? (
        <PomodoroPanel
          onClose={closePanel}
          room={room}
          players={players}
          user={user}
        />
      ) : null}

      {panel === 'chores' ? (
        <ChorePanel
          onClose={closePanel}
          room={room}
          players={players}
          user={user}
          catalog={catalog}
        />
      ) : null}

      {panel === 'studio' ? (
        <Suspense fallback={null}>
          <AvatarStudio onClose={closePanel} />
        </Suspense>
      ) : null}
    </div>
  )
}
