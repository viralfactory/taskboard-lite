import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getProfile, getSessionUser, onAuthChange } from '../lib/api'
import type { Profile } from '../lib/types'

interface AuthState {
  userId: string | null
  email: string | null
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthState>({
  userId: null,
  email: null,
  profile: null,
  loading: true,
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const user = await getSessionUser()
    setUserId(user?.id ?? null)
    setEmail(user?.email ?? null)
    setProfile(user ? await getProfile(user.id) : null)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    return onAuthChange(() => void load())
  }, [])

  return (
    <Ctx.Provider value={{ userId, email, profile, loading, refresh: load }}>{children}</Ctx.Provider>
  )
}

export function useAuth() {
  return useContext(Ctx)
}
