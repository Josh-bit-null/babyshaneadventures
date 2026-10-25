import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  Copy,
  ListChecks,
  LogOut,
  Menu,
  Mic,
  MicOff,
  Sparkles,
  Store,
  Timer,
  UserRound,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { formatMinutes } from '../../game/ocr.js'

export function CoinPill({ coins }) {
  return (
    <span className="coin-pill" title="Coins earned from focus, quizzes and screen-time duels">
      <span className="coin-glyph" aria-hidden>🪙</span>
      <strong>{Number(coins || 0).toLocaleString()}</strong>
    </span>
  )
}

function useCountdown(endsAt, running) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!running || !endsAt) {
      setLeft(0)
      return undefined
    }
    const tick = () => setLeft(Math.max(0, endsAt - Date.now()))
    tick()
    const timer = setInterval(tick, 500)
    return () => clearInterval(timer)
  }, [endsAt, running])
  return left
}

const ACTIONS = [
  { id: 'pomodoro', label: 'Focus', icon: Timer, tone: 'purple' },
  { id: 'study', label: 'Study', icon: BookOpen, tone: 'blue' },
  { id: 'chores', label: 'Chores', icon: ListChecks, tone: 'sand' },
  { id: 'store', label: 'Market', icon: Store, tone: 'gold' },
]

export default function Hud({
  user,
  roomId,
  players,
  coins,
  connection,
  pomodoro,
  plantHealth,
  onOpen,
  onCopyRoom,
  onLogout,
  voice,
  isMobile,
}) {
  const running = pomodoro?.status === 'running'
  const remaining = useCountdown(pomodoro?.endsAt, running)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const menuRef = useRef(null)
  const accountRef = useRef(null)
  const others = players.filter((player) => player.id !== user.id)
  const partner = others[0]
  const seconds = Math.floor(remaining / 1000)
  const clock = useMemo(
    () => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    [seconds],
  )

  useEffect(() => {
    const handler = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false)
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [])

  return (
    <>
      <header className="hud-top">
        <div className="hud-left">
          <button type="button" className="hud-brand" onClick={() => onOpen('studio')} title="Open your Avatar Studio">
            <span className="hud-brand-mark">🍄</span>
            <span className="hud-brand-word">BabyShane</span>
          </button>
          <button type="button" className="room-chip" onClick={onCopyRoom} title="Copy this room code for your partner">
            <span className="room-dot" />
            {roomId}
            <Copy size={11} />
          </button>
          <span className={`connection-chip connection-${connection}`}>
            {connection === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connection === 'online' ? `${players.length} online` : connection === 'connecting' ? 'connecting…' : 'reconnecting…'}
          </span>
          {!partner ? (
            <span className="waiting-chip">Waiting for your partner…</span>
          ) : (
            <span className="partner-chip">
              <span className="partner-orb" /> {partner.name.split(' ')[0]}
              {partner.voiceEnabled ? <Mic size={11} /> : null}
            </span>
          )}
        </div>

        <div className="hud-center">
          {running ? (
            <button type="button" className="focus-chip" onClick={() => onOpen('pomodoro')}>
              <span className={`focus-plant${plantHealth > 0.5 ? '' : ' is-dead'}`}>🪴</span>
              <span>
                <strong>{clock}</strong>
                <small>shared focus</small>
              </span>
            </button>
          ) : pomodoro?.status === 'failed' ? (
            <button type="button" className="focus-chip focus-chip-failed" onClick={() => onOpen('pomodoro')}>
              <span className="focus-plant is-dead">🥀</span>
              <span>
                <strong>Sprout wilted</strong>
                <small>start a fresh session</small>
              </span>
            </button>
          ) : null}
        </div>

        <div className="hud-right">
          <CoinPill coins={coins} />
          <button
            type="button"
            className={`mic-btn${voice.status === 'on' ? ' is-on' : ''}${voice.status === 'requesting' ? ' is-requesting' : ''}`}
            onClick={voice.toggle}
            title={voice.status === 'on' ? 'Turn off proximity voice' : 'Turn on proximity voice'}
          >
            {voice.status === 'on' ? <Mic size={17} /> : <MicOff size={17} />}
            <span className="mic-label">
              {voice.status === 'on'
                ? voice.nearest
                  ? `${voice.nearest.distance.toFixed(1)}m`
                  : 'voice'
                : 'voice off'}
            </span>
          </button>

          <div className="hud-account" ref={accountRef}>
            <button
              type="button"
              className="avatar-btn"
              onClick={() => setAccountOpen((value) => !value)}
              aria-label="Account menu"
            >
              <span className="avatar-btn-face">{user.displayName?.[0]?.toUpperCase() ?? '?'}</span>
              <ChevronDown size={13} />
            </button>
            {accountOpen ? (
              <div className="hud-popover">
                <div className="hud-popover-head">
                  <strong>{user.displayName}</strong>
                  <small>@{user.username}</small>
                </div>
                <button type="button" onClick={() => { setAccountOpen(false); onOpen('studio') }}>
                  <UserRound size={15} /> Avatar Studio
                </button>
                <button type="button" onClick={() => { setAccountOpen(false); onOpen('screentime') }}>
                  <Sparkles size={15} /> Screen-time duel
                </button>
                <button type="button" onClick={() => { setAccountOpen(false); onCopyRoom() }}>
                  <Copy size={15} /> Copy room code
                </button>
                <button type="button" className="is-danger" onClick={onLogout}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            ) : null}
          </div>

          <div className="hud-menu" ref={menuRef}>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="More actions"
            >
              <Menu size={17} />
            </button>
            {menuOpen ? (
              <div className="hud-popover">
                <button type="button" onClick={() => { setMenuOpen(false); onOpen('screentime') }}>
                  <Sparkles size={15} /> Screen-time duel
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); onCopyRoom() }}>
                  <Copy size={15} /> Copy room code
                </button>
                <button type="button" className="is-danger" onClick={onLogout}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {connection !== 'online' ? (
        <div className="reconnect-strip">
          <span className="reconnect-pulse" /> Reconnecting to the island — your avatar will glide back in.
          <X size={13} />
        </div>
      ) : null}

      {isMobile ? (
        <>
          <div className="mobile-dock">
            {ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  type="button"
                  className={`dock-btn dock-${action.tone}`}
                  onClick={() => onOpen(action.id)}
                >
                  <Icon size={19} />
                  <span>{action.label}</span>
                </button>
              )
            })}
            <button type="button" className="dock-btn dock-pink" onClick={() => onOpen('studio')}>
              <UserRound size={19} />
              <span>Me</span>
            </button>
          </div>
          {voice.status === 'on' && voice.nearest ? (
            <div className="voice-distance-chip">
              <Mic size={12} /> {voice.nearest.distance.toFixed(1)} m · {voice.nearest.gain > 0.08 ? 'clear' : 'faint'}
            </div>
          ) : null}
        </>
      ) : (
        <aside className="desktop-dock">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                type="button"
                className={`desktop-dock-btn dock-${action.tone}`}
                onClick={() => onOpen(action.id)}
              >
                <Icon size={19} />
                <span>{action.label}</span>
              </button>
            )
          })}
          <button type="button" className="desktop-dock-btn dock-pink" onClick={() => onOpen('studio')}>
            <UserRound size={19} />
            <span>Studio</span>
          </button>
          <div className="desktop-dock-hint">
            <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk
            <br />
            drag to orbit
          </div>
        </aside>
      )}

      {voice.status === 'on' && !isMobile ? (
        <div className="voice-desktop-chip">
          <span className={`voice-dot${voice.nearest?.gain > 0.08 ? ' is-live' : ''}`} />
          {voice.nearest
            ? `voice · ${voice.nearest.distance.toFixed(1)} m · ${voice.nearest.gain > 0.08 ? 'clear' : 'walk closer'}`
            : 'voice · waiting for partner'}
        </div>
      ) : null}
    </>
  )
}
