import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Panel({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  size = 'md',
  className = '',
  closeLabel = 'Close',
}) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="panel-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.()
    }}>
      <section
        className={`panel panel-${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="panel-head">
          <div className="panel-head-title">
            {icon ? <span className="panel-icon" aria-hidden>{icon}</span> : null}
            <div>
              <h2>{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label={closeLabel}>
            <X size={18} />
          </button>
        </header>
        <div className="panel-body">{children}</div>
        {footer ? <footer className="panel-foot">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  )
}
