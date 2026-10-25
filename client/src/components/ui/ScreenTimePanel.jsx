import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  Clock3,
  ImageUp,
  Loader2,
  Lock,
  ScanLine,
  Sparkles,
  Trophy,
} from 'lucide-react'
import Panel from './Panel.jsx'
import { api } from '../../lib/api.js'
import { formatMinutes, readScreenTimeFromImage } from '../../game/ocr.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

export default function ScreenTimePanel({ onClose, room, players, onRefreshWorld }) {
  const { user, setCoins } = useAuth()
  const { push } = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [statusLabel, setStatusLabel] = useState('')
  const [parsed, setParsed] = useState(null)
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [rawText, setRawText] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dragging, setDragging] = useState(false)

  const duel = room?.worldState?.screenTime
  const submissions = duel?.submissions ?? {}
  const mine = submissions[String(user.id)]
  const partner = players.find((player) => player.id !== user.id)
  const partnerEntry = partner ? submissions[String(partner.id)] : null

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const chooseFile = (next) => {
    if (!next) return
    if (!next.type.startsWith('image/')) {
      setError('Drop a PNG or JPG screenshot of Screen Time or Digital Wellbeing.')
      return
    }
    setFile(next)
    setParsed(null)
    setHours('')
    setMinutes('')
    setRawText('')
    setPhase('ready')
    setError('')
  }

  const scan = async () => {
    if (!file) return
    setPhase('scanning')
    setError('')
    setProgress(0.02)
    setStatusLabel('Loading the reader…')
    try {
      const result = await readScreenTimeFromImage(file, ({ progress: value, label }) => {
        setProgress(value)
        setStatusLabel(label)
      })
      setRawText(result.rawText)
      if (result.minutes == null) {
        setPhase('manual')
        setError('No total screen time found. Enter the hours manually below.')
        return
      }
      setParsed(result)
      setHours(String(Math.floor(result.minutes / 60)))
      setMinutes(String(result.minutes % 60))
      setPhase('parsed')
    } catch (err) {
      setPhase('manual')
      setError(`OCR failed (${err.message}). Enter the total manually.`)
    }
  }

  const totalMinutes = () => {
    const h = Number(hours || 0)
    const m = Number(minutes || 0)
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return null
    const total = h * 60 + m
    if (total <= 0 || total > 100000) return null
    return total
  }

  const submit = async () => {
    const total = totalMinutes()
    if (total == null) {
      setError('Enter a valid total time (minutes must be 0–59).')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await api.post('/api/screentime/submit', {
        roomId: room.id,
        minutes: total,
      })
      setCoins(response.coins)
      onRefreshWorld?.()
      if (response.awarded) {
        if (response.awarded.tie) {
          push({ type: 'info', title: 'Exact tie', message: 'No coins this round — a suspiciously synced pair.', icon: '🤝' })
        } else if (response.awarded.winnerId === user.id) {
          push({
            type: 'reward',
            title: '+500 coins!',
            message: `You spent ${formatMinutes(total)} on your phone — the lower number wins.`,
            icon: '🏆',
          })
        } else {
          push({
            type: 'info',
            title: 'Partner wins this duel',
            message: `${response.awarded.winnerName} logged less screen time and took the 500 coins.`,
            icon: '🌿',
          })
        }
      } else {
        push({
          type: 'success',
          title: 'Screenshot submitted',
          message: partner ? `Waiting for ${partner.name.split(' ')[0]} to submit theirs.` : 'Invite your partner to compare numbers.',
          icon: '📸',
        })
      }
      setPhase('submitted')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setParsed(null)
    setHours('')
    setMinutes('')
    setRawText('')
    setPhase('idle')
    setError('')
  }

  const result = duel?.result

  return (
    <Panel
      title="Screen-time duel"
      subtitle="Read locally. Only the parsed integer leaves your device."
      icon="📸"
      onClose={onClose}
      size="md"
      className="screentime-panel"
    >
      <div className="privacy-banner">
        <Lock size={15} />
        <p>
          Tesseract.js runs the OCR <b>entirely in this browser tab</b>. We never upload
          the screenshot — only the total minutes, so the server can compare the two integers.
        </p>
      </div>

      <div className="duel-scoreboard">
        <div className={`duel-person${mine ? ' is-filled' : ''}`}>
          <span className="duel-avatar" style={{ background: '#74c9a8' }}>{user.displayName[0]}</span>
          <div>
            <strong>{user.displayName.split(' ')[0]} (you)</strong>
            <small>{mine ? `${formatMinutes(mine.minutes)} submitted` : 'no screenshot yet'}</small>
          </div>
          {mine ? <CheckCircle2 size={17} className="duel-check" /> : null}
        </div>
        <span className="duel-vs">VS</span>
        <div className={`duel-person${partnerEntry ? ' is-filled' : ''}`}>
          <span className="duel-avatar" style={{ background: '#ffa6c6' }}>
            {partner ? partner.name[0] : '?'}
          </span>
          <div>
            <strong>{partner ? partner.name.split(' ')[0] : 'Partner'}</strong>
            <small>{partnerEntry ? `${formatMinutes(partnerEntry.minutes)} submitted` : 'waiting'}</small>
          </div>
          {partnerEntry ? <CheckCircle2 size={17} className="duel-check" /> : null}
        </div>
      </div>

      {result ? (
        <div className={`duel-result${result.tie ? ' is-tie' : ''}`}>
          <Trophy size={22} />
          <div>
            <strong>
              {result.tie
                ? 'An exact tie — no coins awarded.'
                : `${result.winnerName} won 500 coins!`}
            </strong>
            <small>
              {Object.entries(result.minutes)
                .map(([id, value]) => {
                  const name = Number(id) === user.id ? 'You' : partner?.name?.split(' ')[0] ?? 'Partner'
                  return `${name}: ${formatMinutes(value)}`
                })
                .join(' · ')}
            </small>
          </div>
        </div>
      ) : null}

      <div
        className={`screentime-drop${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDragging(false)
          chooseFile(event.dataTransfer.files?.[0])
        }}
        onClick={() => !file && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !file) inputRef.current?.click()
        }}
      >
        {preview ? (
          <>
            <img src={preview} alt="Your screen-time screenshot preview" className="screentime-preview" />
            <div className="screentime-preview-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={(event) => { event.stopPropagation(); inputRef.current?.click() }}>
                <ImageUp size={14} /> Replace
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={(event) => { event.stopPropagation(); reset() }}>
                Clear
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="dropzone-icon"><ScanLine size={28} /></span>
            <strong>Drop a Screen Time or Digital Wellbeing screenshot</strong>
            <p>iOS Screen Time, Android Digital Wellbeing, or a weekly average graph.</p>
            <span className="btn btn-secondary btn-sm"><Camera size={15} /> Choose image</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            chooseFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>

      {phase === 'scanning' ? (
        <div className="processing-card compact">
          <div className="processing-orb"><Loader2 className="spin" size={24} /></div>
          <strong>{statusLabel}</strong>
          <div className="progress-track"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <small>Tesseract is reading pixels on your device</small>
        </div>
      ) : null}

      {phase !== 'scanning' && file ? (
        <div className="ocr-readout">
          <div className="ocr-row">
            <label className="field compact">
              <span>Hours</span>
              <input
                type="number"
                min="0"
                max="1668"
                value={hours}
                onChange={(event) => setHours(event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4"
              />
            </label>
            <span className="ocr-colon">:</span>
            <label className="field compact">
              <span>Minutes</span>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="32"
              />
            </label>
            <div className="ocr-total">
              <Clock3 size={14} />
              <strong>{totalMinutes() != null ? formatMinutes(totalMinutes()) : '—'}</strong>
              <small>total</small>
            </div>
          </div>
          {parsed ? (
            <div className="ocr-confidence">
              <Sparkles size={13} /> Tesseract found {formatMinutes(parsed.minutes)} · {Math.round(parsed.confidence * 100)}% confidence
              {rawText ? (
                <details>
                  <summary>raw OCR</summary>
                  <pre>{rawText.slice(0, 1600)}</pre>
                </details>
              ) : null}
            </div>
          ) : (
            <p className="ocr-manual">Edit the numbers if the reader guessed wrong, then submit.</p>
          )}
          <div className="ocr-actions">
            {phase !== 'parsed' ? (
              <button type="button" className="btn btn-secondary" onClick={scan} disabled={!file}>
                <ScanLine size={16} /> Read with Tesseract
              </button>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={scan}>
                <ScanLine size={16} /> Re-scan
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              disabled={submitting || totalMinutes() == null}
            >
              {submitting ? <Loader2 className="spin" size={16} /> : <Trophy size={16} />}
              Submit my number
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="form-error">{error}</div> : null}

      <div className="inline-note">
        <Clock3 size={15} /> Lower integer wins 500 coins. Both partners submit in the same room; a new
        scan after a result starts a fresh duel. Weekly totals over 7 days are compared as-is.
      </div>
    </Panel>
  )
}
