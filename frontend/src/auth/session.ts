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

// Lets the UI re-read the session as soon as it changes, without a reload.
export const SESSION_EVENT = 'app:session'

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
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function clearCurrentUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
  window.dispatchEvent(new Event(SESSION_EVENT))
}

// Full name as stored on the user row, falling back to the email so the UI
// always has something to greet the user with.
export function userDisplayName(user: AuthenticatedUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || user.email
}

const ROLE_LABELS: Record<string, string> = {
  super_user: 'משתמש על',
  logistics_user: 'משתמש לוגיסטי',
  regular_user: 'משתמש רגיל',
}

export function userRoleLabel(user: AuthenticatedUser): string {
  return ROLE_LABELS[user.role] ?? user.role
}
