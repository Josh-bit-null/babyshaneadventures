import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Play, Timer, Wind } from 'lucide-react'
import Panel from './Panel.jsx'
import { net } from '../../net/socket.js'
import { useToast } from '../../context/ToastContext.jsx'

const DURATION = 25 * 60_000

export default function PomodoroPanel({ onClose, room, players, user }) {
  const { push } = useToast()
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const pomodoro = room?.worldState?.pomodoro
  const running = pomodoro?.status === 'running'
  const partner = players.find((player) => player.id !== user.id)

  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [running])

  const remaining = running ? Math.max(0, pomodoro.endsAt - now) : DURATION
  const progress = running ? remaining / (pomodoro.durationMs || DURATION) : 1
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')

  const start = async () => {
    setBusy(true)
    const response = await net.emitWithAck('pomodoro:start', {})
    setBusy(false)
    if (!response?.ok) {
      push({ type: 'error', message: response?.error || 'Could not start the session.' })
      return
    }
    push({
      type: 'success',
      title: '25 minutes, locked in',
      message: 'Keep this tab visible. If it hides, the connection breaks and Sprout wilts.',
      icon: '⏳',
    })
  }

  const cancel = () => {
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
    net.emit('pomodoro:cancel')
    setConfirmCancel(false)
    push({ type: 'info', message: 'Session ended. Sprout took it personally.', icon: '🥀' })
  }

  return (
    <Panel
      title="Co-op focus"
      subtitle="One 25-minute timer, shared by the whole room."
      icon="⏳"
      onClose={onClose}
      size="sm"
      className="pomodoro-panel"
    >
      <div className={`pomo-stage${running ? ' is-running' : ''}${pomodoro?.status === 'failed' ? ' is-failed' : ''}`}>
        <div
          className="pomo-ring"
          style={{
            '--remaining': `${progress * 360}deg`,
          }}
        >
          <div className="pomo-ring-inner">
            <span className="pomo-plant" aria-hidden>
              {pomodoro?.plantHealth > 0.5 ? '🪴' : '🥀'}
            </span>
            <strong>{running ? `${mm}:${ss}` : pomodoro?.status === 'failed' ? '00:00' : '25:00'}</strong>
            <small>
              {running
                ? 'stay on this tab'
                : pomodoro?.status === 'failed'
                  ? 'Sprout wilted'
                  : pomodoro?.status === 'complete'
                    ? 'last session complete'
                    : 'ready when you are'}
            </small>
          </div>
        </div>

        <div className="pomo-status">
          {running ? (
            <>
              <span className="pomo-live"><span /> live now</span>
              <p>
                Started by <b>{pomodoro.startedByName}</b>. Tab hidden or connection lost = Sprout dies.
              </p>
            </>
          ) : pomodoro?.status === 'failed' ? (
            <>
              <span className="pomo-dead"><AlertTriangle size={13} /> focus broken</span>
              <p>
                {pomodoro.failedByName || 'Someone'} {pomodoro.failedReason === 'hidden' ? 'left the tab' : 'slipped away'}.
                The houseplant is dead until a fresh session begins.
              </p>
            </>
          ) : pomodoro?.status === 'complete' ? (
            <>
              <span className="pomo-complete"><CheckCircle2 size={13} /> complete</span>
              <p>Twenty-five shared minutes. Sprout is thriving and your streak is alive.</p>
            </>
          ) : (
            <>
              <span className="pomo-idle"><Wind size={13} /> idle</span>
              <p>Start together. No pausing, no tab-switching, no “just one reel”.</p>
            </>
          )}
        </div>
      </div>

      <div className="pomo-actions">
        {running ? (
          <button
            type="button"
            className={`btn ${confirmCancel ? 'btn-danger' : 'btn-ghost'}`}
            onClick={cancel}
            disabled={busy}
          >
            {confirmCancel ? 'Yes, wilt Sprout' : 'End session early'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-lg" onClick={start} disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : <Play size={17} />}
            {pomodoro?.status === 'failed' ? 'Start fresh & revive Sprout' : 'Start 25-minute focus'}
          </button>
        )}
      </div>

      {confirmCancel ? (
        <div className="inline-note is-warn">
          <AlertTriangle size={15} /> Ending early or hiding the tab kills the plant. A new 25-minute
          session replants it.
        </div>
      ) : null}

      <div className="pomo-rules">
        <div><Timer size={16} /><span><strong>25:00 fixed</strong><small>the server owns the clock</small></span></div>
        <div><Wind size={16} /><span><strong>Visibility policed</strong><small>Page Visibility is polled twice a second</small></span></div>
        <div><span className="pomo-emoji">🪴</span><span><strong>Sprout remembers</strong><small>wilting is saved in the room JSON</small></span></div>
      </div>

      <div className="inline-note">
        {partner
          ? `${partner.name.split(' ')[0]} is in the room. Start the session and both of you see the same countdown.`
          : 'No partner yet — you can still focus, but shared sessions shine with two.'}
      </div>
    </Panel>
  )
}
