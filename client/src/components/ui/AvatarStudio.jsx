import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  Check,
  Info,
  Loader2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'
import Panel from './Panel.jsx'
import { AvatarFigure } from '../world/Avatar.jsx'
import {
  ACCESSORIES,
  AVATAR_LABELS,
  BODY_TYPES,
  HAIR_COLORS,
  HAIR_STYLES,
  HATS,
  OUTFIT_COLORS,
  OUTFIT_STYLES,
  SKIN_TONES,
  EYE_COLORS,
  defaultAvatar,
  withDefaults,
} from '../../game/avatar.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { net } from '../../net/socket.js'

function Turntable({ config, url, walkRef }) {
  const group = useRef()
  useFrame((state) => {
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.55
  })
  return (
    <group ref={group}>
      <AvatarFigure config={config} rpmAvatarUrl={url} walkRef={walkRef} />
    </group>
  )
}

function Preview({ config, url }) {
  const walkRef = useRef(false)
  return (
    <div className="avatar-preview">
      <Canvas
        dpr={[1, 1.7]}
        camera={{ position: [0, 1.5, 7], fov: 45, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.15} color="#fff2f7" />
        <directionalLight position={[3, 5, 4]} intensity={1.9} color="#fff0d6" />
        <pointLight position={[-2.2, 2.2, 2]} intensity={2.4} color="#ffc3d7" />
        <Suspense fallback={null}>
          <group position={[0, 0.05, 0]}>
            <Turntable config={config} url={url} walkRef={walkRef} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
              <circleGeometry args={[1.05, 32]} />
              <meshStandardMaterial color="#ffe5ee" roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.055, 0]}>
              <cylinderGeometry args={[1.05, 1.15, 0.1, 32]} />
              <meshStandardMaterial color="#ffd0de" roughness={0.8} />
            </mesh>
          </group>
        </Suspense>
      </Canvas>
      <span className="preview-badge">live preview</span>
    </div>
  )
}

function Swatches({ colors, value, onChange, label }) {
  return (
    <div className="swatch-row" role="group" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={`swatch${value === color ? ' is-active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
          aria-label={`${label}: ${color}`}
        >
          {value === color ? <Check size={12} /> : null}
        </button>
      ))}
    </div>
  )
}

function Chips({ options, value, onChange, labels }) {
  return (
    <div className="chip-row">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`choice-chip${value === option ? ' is-active' : ''}`}
          onClick={() => onChange(option)}
        >
          {labels?.[option] ?? option}
        </button>
      ))}
    </div>
  )
}

function Slider({ label, value, min, max, step = 0.01, onChange, hint }) {
  return (
    <label className="slider-field">
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{Number(value).toFixed(2)}</output>
    </label>
  )
}

export default function AvatarStudio({ onClose }) {
  const { user, saveAvatar } = useAuth()
  const { push } = useToast()
  const [draft, setDraft] = useState(() => withDefaults(user.avatarConfig))
  const [glbUrl, setGlbUrl] = useState(user.rpmAvatarUrl ?? '')
  const [previewUrl, setPreviewUrl] = useState(user.rpmAvatarUrl ?? '')
  const [tab, setTab] = useState('body')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }))

  const presets = useMemo(
    () => [
      { id: 'mushroom', label: 'Mushroom Joshua', emoji: '🍄' },
      { id: 'siopao', label: 'Siopao RikaShane', emoji: '🥟' },
      { id: 'guest', label: 'Fresh explorer', emoji: '🌱' },
    ],
    [],
  )

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await saveAvatar({
        avatarConfig: draft,
        rpmAvatarUrl: glbUrl.trim() ? glbUrl.trim() : null,
      })
      setPreviewUrl(glbUrl.trim())
      net.emit('profile:refresh')
      push({
        type: 'success',
        title: 'Look saved',
        message: 'Your avatar is updated in the 3D world for both players.',
        icon: '🪞',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title="Avatar Studio"
      subtitle="Body shape, facial proportions, hair and outfits — saved to your account."
      icon="🪞"
      onClose={onClose}
      size="lg"
      className="studio-panel"
      footer={
        <div className="panel-foot-row">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setDraft(withDefaults(user.avatarConfig))
              setGlbUrl(user.rpmAvatarUrl ?? '')
              setPreviewUrl(user.rpmAvatarUrl ?? '')
              setError('')
            }}
          >
            <RotateCcw size={14} /> Reset changes
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            Save look
          </button>
        </div>
      }
    >
      <div className="studio-layout">
        <div className="studio-visual">
          <Preview config={draft} url={previewUrl} />
          <div className="studio-identity">
            <span className="studio-persona">{draft.persona === 'siopao' ? '🥟' : draft.persona === 'mushroom' ? '🍄' : '🌱'}</span>
            <div>
              <strong>{user.displayName}</strong>
              <small>@{user.username}</small>
            </div>
          </div>
          <div className="preset-row">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-chip"
                onClick={() => {
                  setDraft(defaultAvatar(preset.id))
                  setPreviewUrl('')
                  setGlbUrl('')
                }}
              >
                {preset.emoji} {preset.label}
              </button>
            ))}
          </div>
          <div className="inline-note compact">
            <Info size={14} />
            Ready Player Me shut down on 31 Jan 2026. The default pair is rendered natively here;
            previously exported RPM <code>.glb</code> files can still be mapped into the scene.
          </div>
        </div>

        <div className="studio-controls">
          <nav className="studio-tabs">
            {[
              ['body', 'Body'],
              ['face', 'Face'],
              ['hair', 'Hair'],
              ['style', 'Style'],
              ['glb', 'GLB'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'is-active' : ''}
                onClick={() => setTab(id)}
              >
                {id === 'glb' ? <SlidersHorizontal size={13} /> : null}
                {label}
              </button>
            ))}
          </nav>

          {tab === 'body' ? (
            <div className="control-stack">
              <div className="control-block">
                <span className="control-label">Body shape</span>
                <Chips
                  options={BODY_TYPES}
                  value={draft.body}
                  onChange={(value) => set('body', value)}
                  labels={AVATAR_LABELS.body}
                />
              </div>
              <Slider
                label="Height"
                hint="0.85× – 1.12×"
                min={0.85}
                max={1.12}
                value={draft.height}
                onChange={(value) => set('height', value)}
              />
              <div className="control-block">
                <span className="control-label">Skin tone</span>
                <Swatches colors={SKIN_TONES} value={draft.skinTone} onChange={(value) => set('skinTone', value)} label="Skin tone" />
              </div>
            </div>
          ) : null}

          {tab === 'face' ? (
            <div className="control-stack">
              <Slider label="Eye size" min={0.6} max={1.5} value={draft.eyeSize} onChange={(value) => set('eyeSize', value)} />
              <Slider label="Eye spacing" min={0.6} max={1.5} value={draft.eyeSpacing} onChange={(value) => set('eyeSpacing', value)} />
              <Slider label="Smile" min={0} max={1} value={draft.smile} onChange={(value) => set('smile', value)} />
              <div className="control-block">
                <span className="control-label">Eye colour</span>
                <Swatches colors={EYE_COLORS} value={draft.eyeColor} onChange={(value) => set('eyeColor', value)} label="Eye colour" />
              </div>
              <div className="control-block">
                <span className="control-label">Accessory</span>
                <Chips
                  options={ACCESSORIES}
                  value={draft.accessory}
                  onChange={(value) => set('accessory', value)}
                  labels={AVATAR_LABELS.accessory}
                />
              </div>
            </div>
          ) : null}

          {tab === 'hair' ? (
            <div className="control-stack">
              <div className="control-block">
                <span className="control-label">Hair style</span>
                <Chips
                  options={HAIR_STYLES}
                  value={draft.hairStyle}
                  onChange={(value) => set('hairStyle', value)}
                  labels={AVATAR_LABELS.hairStyle}
                />
              </div>
              <div className="control-block">
                <span className="control-label">Hair colour</span>
                <Swatches colors={HAIR_COLORS} value={draft.hairColor} onChange={(value) => set('hairColor', value)} label="Hair colour" />
              </div>
            </div>
          ) : null}

          {tab === 'style' ? (
            <div className="control-stack">
              <div className="control-block">
                <span className="control-label">Outfit</span>
                <Chips
                  options={OUTFIT_STYLES}
                  value={draft.outfitStyle}
                  onChange={(value) => set('outfitStyle', value)}
                  labels={AVATAR_LABELS.outfitStyle}
                />
              </div>
              <div className="control-block">
                <span className="control-label">Outfit colour</span>
                <Swatches
                  colors={OUTFIT_COLORS}
                  value={draft.outfitColor}
                  onChange={(value) => set('outfitColor', value)}
                  label="Outfit colour"
                />
              </div>
              <div className="control-block">
                <span className="control-label">Hat</span>
                <Chips
                  options={HATS}
                  value={draft.hat}
                  onChange={(value) => set('hat', value)}
                  labels={AVATAR_LABELS.hat}
                />
              </div>
            </div>
          ) : null}

          {tab === 'glb' ? (
            <div className="control-stack">
              <div className="glb-note">
                <UserRound size={16} />
                <p>
                  Paste a ready-player-me <code>.glb</code> URL you already exported. We load it
                  through the same <code>useLoader</code> pipeline and drop it into the R3F scene.
                  If it fails or is CORS-blocked, your chibi look is the fallback.
                </p>
              </div>
              <label className="field">
                <span>Avatar GLB URL</span>
                <input
                  value={glbUrl}
                  onChange={(event) => setGlbUrl(event.target.value)}
                  placeholder="https://cdn.example.com/avatar.glb"
                  spellCheck={false}
                />
              </label>
              <div className="glb-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setPreviewUrl(glbUrl.trim())
                    push({ type: 'info', message: 'Previewing the external GLB. Save to keep it.' })
                  }}
                >
                  Preview GLB
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setGlbUrl('')
                    setPreviewUrl('')
                  }}
                >
                  Use chibi avatar
                </button>
              </div>
              <div className="inline-note is-warn">
                Only load a GLB URL you trust. External assets are rendered directly in your scene and
                are not cached by our service worker.
              </div>
            </div>
          ) : null}

          {error ? <div className="form-error">{error}</div> : null}
        </div>
      </div>
    </Panel>
  )
}
