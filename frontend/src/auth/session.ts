export interface AuthenticatedUser {
  id: string
  firstName: string | null
  lastName: string | null
  personalNumber: string | null
  email: string
  role: string
  unit: string | null
  anaf: string | null
  mador: string | null
  team: string | null
  orgScopeId: string | null
}

const STORAGE_KEY = 'go-south.user'

// The backend authenticates requests with the user's id (`x-user-id`), so the
// signed-in user is all the session state the client needs to keep.
export function getCurrentUser(): AuthenticatedUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthenticatedUser) : null
  } catch {
    return null
  }
}

export function getCurrentUserId(): string | null {
  return getCurrentUser()?.id ?? null
}

export function setCurrentUser(user: AuthenticatedUser): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } catch {
    // Private browsing or blocked storage: the session simply will not persist.
  }
}

export function clearCurrentUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
