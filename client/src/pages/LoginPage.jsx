import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Sparkles,
  UserRoundPlus,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { isStandalone } from '../lib/device.js'

const LoginDiorama = lazy(() => import('../components/world/LoginDiorama.jsx'))

const DEMOS = [
  {
    username: 'joshua',
    name: 'Mushroom Joshua',
    persona: 'mushroom',
    emoji: '🍄',
    blurb: 'Mushroom cap, red hoodie, plant dad energy.',
  },
  {
    username: 'rika',
    name: 'Siopao RikaShane',
    persona: 'siopao',
    emoji: '🥟',
    blurb: 'Siopao buns, lavender dress, quiz machine.',
  },
]

export default function LoginPage() {
  const { login, register, setRoomId, defaultRoom, offline } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [persona, setPersona] = useState('mushroom')
  const [room, setRoom] = useState(defaultRoom)
  const [showPin, setShowPin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const finish = (user) => {
    if (!setRoomId(room)) {
      setError('Room code must be 3–32 lowercase letters, numbers or dashes.')
      return false
    }
    push({
      type: 'success',
      title: `Welcome, ${user.displayName.split(' ')[0]}`,
      message: `Room “${room}” is open. Your partner can join with the same code.`,
      icon: '🍄',
    })
    navigate('/play', { replace: true })
    return true
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (!setRoomId(room)) {
        throw new Error('Room code must be 3–32 lowercase letters, numbers or dashes.')
      }
      const user =
        mode === 'signin'
          ? await login(username.trim().toLowerCase(), pin)
          : await register({
              username: username.trim().toLowerCase(),
              pin,
              displayName: displayName.trim(),
              persona,
            })
      finish(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const demoLogin = async (demo) => {
    setError('')
    setBusy(true)
    try {
      if (!setRoomId(room)) throw new Error('Check the room code.')
      const user = await login(demo.username, '1234')
      finish(user)
    } catch (err) {
      setError(
        `${err.message} Demo accounts only exist when SEED_DEMO is enabled on the server.`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <section className="login-hero">
        <div className="brand">
          <span className="brand-mark">🍄</span>
          <span className="brand-word">
            BabyShane<span>Adventures</span>
          </span>
        </div>
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={14} /> A tiny world for two</p>
          <h1>
            Study together.
            <br />
            Grow a <em>home</em>.
          </h1>
          <p className="hero-sub">
            One floating island, two avatars, and a houseplant that judges you.
            Focus together, beat screen-time, and turn chores into furniture.
          </p>
          <div className="hero-chips">
            <span>🎮 3D co-op</span>
            <span>⏳ 25-min focus</span>
            <span>📸 OCR duels</span>
            <span>🪴 Sprout lives</span>
          </div>
        </div>
        <Suspense fallback={<div className="diorama" aria-hidden />}>
          <LoginDiorama />
        </Suspense>
        <p className="diorama-caption">Mushroom Joshua &amp; Siopao RikaShane</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-head">
            <div>
              <p className="eyebrow"><LockKeyhole size={13} /> Private pair</p>
              <h2>{mode === 'signin' ? 'Open the island' : 'Make a new explorer'}</h2>
            </div>
            <span className="secure-pill">HttpOnly JWT</span>
          </div>

          {offline ? (
            <div className="inline-note is-warn">
              <WifiOff size={15} /> You are offline. Sign-in needs the island server.
            </div>
          ) : null}

          <div className="segmented">
            <button
              type="button"
              className={mode === 'signin' ? 'is-active' : ''}
              onClick={() => { setMode('signin'); setError('') }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'create' ? 'is-active' : ''}
              onClick={() => { setMode('create'); setError('') }}
            >
              <UserRoundPlus size={14} /> Create
            </button>
          </div>

          <form onSubmit={submit} className="stack">
            {mode === 'create' ? (
              <label className="field">
                <span>Display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Mushroom Joshua"
                  maxLength={24}
                  autoComplete="nickname"
                  required
                />
              </label>
            ) : null}

            <label className="field">
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="joshua"
                autoCapitalize="none"
                autoComplete="username"
                maxLength={20}
                required
              />
            </label>

            <label className="field">
              <span>PIN</span>
              <div className="input-with-action">
                <input
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="1234"
                  inputMode="numeric"
                  pattern="\d{4,8}"
                  type={showPin ? 'text' : 'password'}
                  autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                  required
                />
                <button type="button" onClick={() => setShowPin((value) => !value)} aria-label="Toggle PIN visibility">
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {mode === 'create' ? (
              <div className="field">
                <span>Starting avatar</span>
                <div className="persona-row">
                  {[
                    { id: 'mushroom', label: 'Mushroom', emoji: '🍄' },
                    { id: 'siopao', label: 'Siopao', emoji: '🥟' },
                    { id: 'guest', label: 'Guest', emoji: '🌱' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`persona-chip${persona === option.id ? ' is-active' : ''}`}
                      onClick={() => setPersona(option.id)}
                    >
                      <span>{option.emoji}</span>{option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="field">
              <span>Shared room code</span>
              <input
                value={room}
                onChange={(event) => setRoom(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32))}
                placeholder="sunny-hideaway"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
              <small>Both of you must enter the same code to share the island.</small>
            </label>

            {error ? <div className="form-error" role="alert">{error}</div> : null}

            <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : null}
              {mode === 'signin' ? 'Enter the island' : 'Create my explorer'}
              {!busy ? <ArrowRight size={17} /> : null}
            </button>
          </form>

          <div className="demo-block">
            <div className="divider"><span>The demo pair · PIN 1234</span></div>
            <div className="demo-grid">
              {DEMOS.map((demo) => (
                <button
                  key={demo.username}
                  type="button"
                  className="demo-card"
                  onClick={() => demoLogin(demo)}
                  disabled={busy}
                >
                  <span className="demo-emoji">{demo.emoji}</span>
                  <strong>{demo.name}</strong>
                  <small>{demo.blurb}</small>
                  <span className="demo-play">Play as {demo.username} <ArrowRight size={12} /></span>
                </button>
              ))}
            </div>
          </div>

          <div className="login-foot">
            {installPrompt && !isStandalone ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await installPrompt.prompt()
                  setInstallPrompt(null)
                }}
              >
                Add to Home Screen
              </button>
            ) : (
              <span>Standalone PWA · .glb files cached on device</span>
            )}
            <span className="login-foot-dot" />
            <span>No passwords stored in the browser</span>
          </div>
        </div>
      </section>
    </main>
  )
}
