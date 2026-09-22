import { useEffect, useState } from 'react'
import { SESSION_EVENT, getCurrentUser, type AuthenticatedUser } from './session'

export function useCurrentUser(): AuthenticatedUser | null {
  const [user, setUser] = useState<AuthenticatedUser | null>(getCurrentUser)

  useEffect(() => {
    const update = () => setUser(getCurrentUser())
    window.addEventListener(SESSION_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(SESSION_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  return user
}
