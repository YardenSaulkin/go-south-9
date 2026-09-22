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
  orgCode: string | null
}

const STORAGE_KEY = 'go-south.user'
export const SESSION_EVENT = 'app:session'

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
    // Storage can be unavailable in private browsing; the session will not persist.
  }
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function clearCurrentUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function userDisplayName(user: AuthenticatedUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || user.email
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל מערכת',
  poc: 'אחראי תחום',
  normal: 'משתמש רגיל',
}

export function userRoleLabel(user: AuthenticatedUser): string {
  return ROLE_LABELS[user.role] ?? user.role
}
