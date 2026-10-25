import { useEffect, useRef, useState } from 'react'
import nipplejs from 'nipplejs'
import { clearJoystick, setJoystick } from '../../game/input.js'

/**
 * Virtual joystick for touch devices only. The UI layer decides not to mount
 * this at all on PC (user-agent + pointer coarse check in PlayPage).
 */
export default function Joystick({ disabled = false }) {
  const zoneRef = useRef(null)
  const managerRef = useRef(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!zoneRef.current) return undefined
    const manager = nipplejs.create({
      zone: zoneRef.current,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: '#ff8fb1',
      size: 118,
      threshold: 0.08,
      fadeTime: 180,
      restJoystick: true,
      dynamicPage: true,
      dataOnly: false,
    })
    managerRef.current = manager

    manager.on('start', () => setActive(true))
    manager.on('move', (_event, data) => {
      if (!data?.vector) return
      setJoystick(data.vector.x, data.vector.y, true)
      setActive(true)
    })
    manager.on('end', () => {
      clearJoystick()
      setActive(false)
    })

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        clearJoystick()
        setActive(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      manager.destroy()
      managerRef.current = null
      clearJoystick()
    }
  }, [])

  useEffect(() => {
    if (disabled) {
      clearJoystick()
      setActive(false)
    }
  }, [disabled])

  return (
    <div className={`joystick-wrap${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}>
      <div ref={zoneRef} className="joystick-zone" aria-hidden />
      <span className="joystick-hint">{disabled ? 'Panel open' : active ? 'Walk' : 'Drag to walk'}</span>
    </div>
  )
}
