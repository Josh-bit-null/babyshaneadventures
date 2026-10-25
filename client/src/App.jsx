import { Component, lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'))
const PlayPage = lazy(() => import('./pages/PlayPage.jsx'))

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[app] crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <div className="fatal-card">
            <span className="fatal-emoji">🍄</span>
            <h1>The island hiccupped.</h1>
            <p>{this.state.error.message || 'Something unexpected happened.'}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload the island
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function Splash() {
  return (
    <div className="boot-screen">
      <span className="boot-bun">🍄</span>
      <p>Waking up the island…</p>
    </div>
  )
}

function RequireAuth({ children }) {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Splash />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}

function LoginRoute() {
  const { user, status } = useAuth()
  if (status === 'loading') return <Splash />
  if (user) return <Navigate to="/play" replace />
  return <LoginPage />
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <Suspense fallback={<Splash />}>
                  <LoginRoute />
                </Suspense>
              }
            />
            <Route
              path="/play"
              element={
                <RequireAuth>
                  <Suspense fallback={<Splash />}>
                    <PlayPage />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route
              path="/store"
              element={
                <RequireAuth>
                  <Suspense fallback={<Splash />}>
                    <PlayPage initialPanel="store" />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route path="/" element={<Navigate to="/play" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </AppErrorBoundary>
  )
}
