import { useState } from 'react'
import {
  BadgeCheck,
  Check,
  Clock3,
  Gift,
  Hand,
  Loader2,
  LockKeyhole,
  RotateCcw,
} from 'lucide-react'
import Panel from './Panel.jsx'
import { net } from '../../net/socket.js'
import { useToast } from '../../context/ToastContext.jsx'

const STATUS_LABEL = {
  open: 'Open',
  pending: 'Awaiting verification',
  done: 'Verified',
}

export default function ChorePanel({ onClose, room, players, user, catalog }) {
  const { push } = useToast()
  const [busy, setBusy] = useState(null)
  const chores = room?.worldState?.chores ?? []
  const partner = players.find((player) => player.id !== user.id)

  const act = async (event, choreId) => {
    setBusy(`${event}:${choreId}`)
    const response = await net.emitWithAck(event, { choreId })
    setBusy(null)
    if (!response?.ok) {
      push({ type: 'error', message: response?.error || 'Could not update that chore.' })
    }
  }

  const rewardFor = (sku) => catalog?.items?.find((item) => item.sku === sku)

  return (
    <Panel
      title="Spatial chore board"
      subtitle="One of you does the real-world thing. The other verifies. Rare furniture drops."
      icon="🧹"
      onClose={onClose}
      size="md"
      className="chore-panel"
    >
      <div className="chore-banner">
        <div>
          <p className="eyebrow"><Hand size={13} /> Pair-verified</p>
          <h3>Chores become furniture.</h3>
          <p>
            Claim a task, finish it in the real world, then your partner taps verify.
            The reward lands in your shared inventory with exact coordinates.
          </p>
        </div>
        <span className={`chore-partner-status${partner ? ' is-online' : ''}`}>
          <span /> {partner ? `${partner.name.split(' ')[0]} online` : 'partner away'}
        </span>
      </div>

      <div className="chore-list">
        {chores.map((chore) => {
          const reward = rewardFor(chore.rewardSku)
          const claimedByMe = chore.claimedBy === user.id
          const canVerify = chore.status === 'pending' && !claimedByMe && Boolean(partner)
          return (
            <article key={chore.id} className={`chore-card chore-${chore.status}`}>
              <div className="chore-icon" aria-hidden>{chore.icon}</div>
              <div className="chore-body">
                <div className="chore-title-row">
                  <h4>{chore.label}</h4>
                  <span className={`chore-status status-${chore.status}`}>{STATUS_LABEL[chore.status]}</span>
                </div>
                <p>{chore.blurb}</p>
                <div className="chore-reward">
                  <Gift size={14} />
                  <span>{reward?.icon} {reward?.name ?? 'Rare furniture'}</span>
                  <small>rare · shared drop</small>
                </div>

                {chore.status === 'pending' ? (
                  <div className="chore-pending-note">
                    <Clock3 size={14} />
                    {claimedByMe
                      ? `Waiting for ${partner?.name?.split(' ')[0] ?? 'your partner'} to verify.`
                      : `${chore.claimedByName} asked you to verify.`}
                  </div>
                ) : null}

                {chore.status === 'done' ? (
                  <div className="chore-done-note">
                    <BadgeCheck size={14} />
                    Completed by {chore.claimedByName} · verified by {chore.verifiedByName}
                  </div>
                ) : null}

                <div className="chore-actions">
                  {chore.status === 'open' ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => act('chore:claim', chore.id)}
                      disabled={Boolean(busy)}
                    >
                      {busy === `chore:claim:${chore.id}` ? <Loader2 className="spin" size={14} /> : <Hand size={14} />}
                      I did this
                    </button>
                  ) : null}

                  {chore.status === 'pending' && claimedByMe ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => act('chore:release', chore.id)}
                      disabled={Boolean(busy)}
                    >
                      {busy === `chore:release:${chore.id}` ? <Loader2 className="spin" size={14} /> : <RotateCcw size={14} />}
                      Undo claim
                    </button>
                  ) : null}

                  {canVerify ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => act('chore:verify', chore.id)}
                      disabled={Boolean(busy)}
                    >
                      {busy === `chore:verify:${chore.id}` ? <Loader2 className="spin" size={14} /> : <Check size={14} />}
                      Verify &amp; drop reward
                    </button>
                  ) : null}

                  {chore.status === 'pending' && !partner ? (
                    <span className="chore-locked"><LockKeyhole size={13} /> verification needs your partner</span>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className="inline-note">
        <BadgeCheck size={15} /> Rewards are written to the room’s shared inventory (`user_id = 0`) and
        broadcast to both players immediately.
      </div>
    </Panel>
  )
}
