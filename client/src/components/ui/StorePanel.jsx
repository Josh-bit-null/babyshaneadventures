import { useMemo, useState } from 'react'
import {
  Check,
  Coins,
  Gem,
  Loader2,
  Paintbrush,
  ShoppingBag,
  Sparkles,
  Wand2,
} from 'lucide-react'
import Panel from './Panel.jsx'
import { api } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

function Swatches({ palette }) {
  if (!palette) return null
  return (
    <span className="shop-swatches">
      {[palette.skyTop, palette.grass, palette.deck, palette.accent].map((color) => (
        <span key={color} style={{ background: color }} />
      ))}
    </span>
  )
}

export default function StorePanel({ catalog, inventory, room, onClose, onMove, onRefreshWorld, fullPage }) {
  const { user, setCoins } = useAuth()
  const { push } = useToast()
  const [category, setCategory] = useState('furniture')
  const [buying, setBuying] = useState(null)
  const [applying, setApplying] = useState(null)
  const [error, setError] = useState('')

  const ownedCounts = useMemo(() => {
    const map = new Map()
    for (const item of inventory) {
      if (item.ownerId === user.id || item.ownerId === 0) {
        map.set(item.sku, (map.get(item.sku) ?? 0) + 1)
      }
    }
    return map
  }, [inventory, user.id])

  const movable = useMemo(
    () =>
      inventory
        .filter((item) => item.ownerId === user.id || item.ownerId === 0)
        .map((item) => ({ item, definition: catalog.items.find((entry) => entry.sku === item.sku) }))
        .filter(({ definition }) => definition?.kind === 'model'),
    [inventory, catalog, user.id],
  )

  const items = useMemo(
    () => catalog.items.filter((item) => item.category === category),
    [catalog, category],
  )

  const buy = async (item) => {
    setError('')
    setBuying(item.sku)
    try {
      const response = await api.post('/api/store/purchase', { roomId: room.id, sku: item.sku })
      setCoins(response.user.coins)
      onRefreshWorld?.()
      push({
        type: item.kind === 'theme' ? 'success' : 'reward',
        title: item.kind === 'theme' ? `${item.name} applied` : `${item.name} delivered`,
        message:
          item.kind === 'theme'
            ? 'The whole island changed palette for both of you.'
            : 'Tap it in “Your home” to move it anywhere on the island.',
        icon: item.icon,
      })
    } catch (err) {
      setError(err.message)
      push({ type: 'error', message: err.message, icon: '🪙' })
    } finally {
      setBuying(null)
    }
  }

  const applyTheme = async (item) => {
    setError('')
    setApplying(item.sku)
    try {
      await api.post(`/api/rooms/${room.id}/theme`, { themeSku: item.sku })
      onRefreshWorld?.()
      push({ type: 'success', message: `${item.name} is now live.`, icon: item.icon })
    } catch (err) {
      setError(err.message)
    } finally {
      setApplying(null)
    }
  }

  const startMove = (item) => {
    onMove?.(item)
    onClose?.()
  }

  return (
    <Panel
      title="The Little Market"
      subtitle={`${user.coins.toLocaleString()} coins · everything you place is visible to your partner`}
      icon="🪙"
      onClose={onClose}
      size="lg"
      className={`store-panel${fullPage ? ' is-full' : ''}`}
    >
      <div className="store-hero">
        <div>
          <p className="eyebrow"><ShoppingBag size={13} /> Modular home economy</p>
          <h3>Build a home that looks like <em>you two</em>.</h3>
          <p>
            Buy house parts, pets and palettes. Furniture is saved with exact XYZ
            coordinates in MariaDB, so it is exactly where you left it next time.
          </p>
        </div>
        <div className="store-wallet">
          <span><Coins size={15} /> Your balance</span>
          <strong>🪙 {user.coins.toLocaleString()}</strong>
          <small>Earn: perfect quiz +300 · screen-time win +500</small>
        </div>
      </div>

      <nav className="shop-tabs" aria-label="Store categories">
        {catalog.categories.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={category === entry.id ? 'is-active' : ''}
            onClick={() => setCategory(entry.id)}
          >
            <span aria-hidden>{entry.icon}</span>
            {entry.label}
          </button>
        ))}
      </nav>

      {error ? <div className="form-error">{error}</div> : null}

      <div className="shop-grid">
        {items.map((item) => {
          const count = ownedCounts.get(item.sku) ?? 0
          const themeOwned = item.sku === 'theme-meadow' || count > 0
          const activeTheme = room.theme === item.sku
          const locked = item.earnOnly && count === 0
          const soldTheme = item.kind === 'theme' && themeOwned
          const canAfford = user.coins >= item.price
          return (
            <article
              key={item.sku}
              className={`shop-card cat-${item.category}${locked ? ' is-locked' : ''}${activeTheme ? ' is-active-theme' : ''}`}
            >
              <div className="shop-art">
                <span className="shop-emoji" aria-hidden>{item.icon}</span>
                {item.rarity === 'rare' ? <span className="shop-rarity"><Gem size={11} /> rare</span> : null}
                {count > 0 && item.kind === 'model' ? <span className="shop-owned"><Check size={11} /> {count}</span> : null}
                {activeTheme ? <span className="shop-owned"><Check size={11} /> live</span> : null}
              </div>
              <div className="shop-copy">
                <div className="shop-name-row">
                  <h4>{item.name}</h4>
                  {item.kind === 'theme' ? <Swatches palette={item.palette} /> : null}
                </div>
                <p>{item.blurb}</p>
                <div className="shop-actions">
                  {locked ? (
                    <span className="shop-earn"><Wand2 size={13} /> Earned by chore verification</span>
                  ) : item.kind === 'theme' ? (
                    soldTheme ? (
                      item.sku === 'theme-meadow' || activeTheme ? (
                        <span className="shop-included"><Check size={13} /> Included</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => applyTheme(item)}
                          disabled={applying === item.sku}
                        >
                          {applying === item.sku ? <Loader2 className="spin" size={14} /> : <Paintbrush size={14} />}
                          Apply theme
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => buy(item)}
                        disabled={buying === item.sku || !canAfford}
                      >
                        {buying === item.sku ? <Loader2 className="spin" size={14} /> : <Paintbrush size={14} />}
                        {item.price === 0 ? 'Unlock' : `Buy · ${item.price}`}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => buy(item)}
                      disabled={buying === item.sku || !canAfford}
                      title={!canAfford ? 'Not enough coins yet' : `Buy ${item.name}`}
                    >
                      {buying === item.sku ? <Loader2 className="spin" size={14} /> : <Coins size={14} />}
                      {count > 0 ? 'Buy another' : 'Buy'} · {item.price}
                    </button>
                  )}
                  {!canAfford && !soldTheme && !locked && item.price > 0 ? (
                    <small className="shop-short">Need {item.price - user.coins} more</small>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <section className="home-shelf">
        <div className="home-shelf-head">
          <div>
            <p className="eyebrow"><Sparkles size={13} /> Your home</p>
            <h3>Placed pieces you can rearrange</h3>
          </div>
          <small>Tap an item, then tap the island to move it.</small>
        </div>
        {movable.length === 0 ? (
          <p className="empty-state">Your shelf is empty. Buy a lamp, a rug, or a suspiciously large penguin.</p>
        ) : (
          <div className="owned-grid">
            {movable.map(({ item, definition }) => (
              <button
                key={item.uid}
                type="button"
                className="owned-chip"
                onClick={() => startMove(item)}
                title={`Move ${definition.name}`}
              >
                <span className="owned-emoji">{definition.icon}</span>
                <span>
                  <strong>{definition.name}</strong>
                  <small>{item.ownerId === 0 ? 'shared' : 'yours'} · move</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </Panel>
  )
}
