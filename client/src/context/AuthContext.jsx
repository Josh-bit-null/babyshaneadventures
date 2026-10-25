import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'

const AuthContext = createContext(null)
const ROOM_KEY = 'bsa.room'
const DEFAULT_ROOM = 'sunny-hideaway'

const readRoom = () => {
  const stored = window.localStorage.getItem(ROOM_KEY)
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(stored ?? '') ? stored : DEFAULT_ROOM
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [roomId, setRoomIdState] = useState(readRoom)
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    let alive = true
    api
      .get('/api/auth/me')
      .then(({ user: row }) => {
        if (alive) {
          setUser(row)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (alive) {
          setUser(null)
          setStatus('ready')
        }
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('bsa:unauthorized', onUnauthorized)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('bsa:unauthorized', onUnauthorized)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const setRoomId = useCallback((next) => {
    const value = String(next || DEFAULT_ROOM).toLowerCase().trim()
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(value)) return false
    window.localStorage.setItem(ROOM_KEY, value)
    setRoomIdState(value)
    return true
  }, [])

  const login = useCallback(async (username, pin) => {
    const { user: row } = await api.post('/api/auth/login', { username, pin })
    setUser(row)
    return row
  }, [])

  const register = useCallback(async (payload) => {
    const { user: row } = await api.post('/api/auth/register', payload)
    setUser(row)
    return row
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {})
    } catch {
      /* clear locally regardless */
    }
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const { user: row } = await api.get('/api/auth/me')
      setUser(row)
      return row
    } catch {
      return null
    }
  }, [])

  const saveAvatar = useCallback(async ({ avatarConfig, rpmAvatarUrl }) => {
    const { user: row } = await api.patch('/api/auth/avatar', {
      avatarConfig,
      rpmAvatarUrl,
    })
    setUser(row)
    return row
  }, [])

  const setCoins = useCallback((coins) => {
    setUser((current) => (current ? { ...current, coins: Number(coins) } : current))
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      roomId,
      setRoomId,
      login,
      register,
      logout,
      refresh,
      saveAvatar,
      setCoins,
      offline,
      defaultRoom: DEFAULT_ROOM,
    }),
    [user, status, roomId, setRoomId, login, register, logout, refresh, saveAvatar, setCoins, offline],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
