import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Info, PartyPopper, TriangleAlert, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
  reward: PartyPopper,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const push = useCallback(
    (options) => {
      const toast =
        typeof options === 'string' ? { message: options } : { ...options }
      const id = crypto.randomUUID()
      const entry = { id, type: 'info', ttl: 4200, ...toast }
      setToasts((current) => [...current.slice(-3), entry])
      if (entry.ttl > 0) {
        const timer = setTimeout(() => dismiss(id), entry.ttl)
        timers.current.set(id, timer)
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] ?? Info
          return (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <span className={`toast-icon toast-icon-${toast.type}`}>
                {toast.icon ? <span aria-hidden>{toast.icon}</span> : <Icon size={18} />}
              </span>
              <div className="toast-copy">
                {toast.title ? <strong>{toast.title}</strong> : null}
                <p>{toast.message}</p>
              </div>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
