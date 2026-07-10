import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchCsrf, fetchMe, login as apiLogin, logout as apiLogout } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Always ensure a fresh csrftoken cookie exists — needed for logout (and
    // any other write) even when the session was restored on page load
    // without going through login() first.
    fetchCsrf()
      .catch(() => {})
      .finally(() => {
        fetchMe()
          .then(setUser)
          .catch(() => setUser(null))
          .finally(() => setLoading(false))
      })
  }, [])

  const login = async (username, password) => {
    await fetchCsrf()
    const data = await apiLogin(username, password)
    // A previous user's queries (automatisations, surveillance, dashboard...)
    // must never leak into this session — React Query's cache is keyed by
    // query name, not by user, so without this a second account logging in
    // in the same tab would briefly (or persistently) see the prior user's
    // cached data instead of their own scoped results.
    queryClient.clear()
    setUser(data)
    return data
  }

  const logout = async () => {
    try {
      await apiLogout()
    } finally {
      // Always clear client-side state, even if the server call failed
      // (expired session, CSRF hiccup, network) — the user still expects
      // to be logged out locally and sent back to the login page.
      queryClient.clear()
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isDrh: user?.role === 'DRH' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
