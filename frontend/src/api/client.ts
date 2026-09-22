import { getCurrentUserId } from '../auth/session'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export interface ApiIssue {
  path: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly issues: ApiIssue[]

  constructor(message: string, status: number, issues: ApiIssue[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.issues = issues
  }
}

interface ApiErrorBody {
  message?: string | string[]
  issues?: ApiIssue[]
}

function messageFor(status: number, body: ApiErrorBody | null): string {
  const raw = body?.message
  if (Array.isArray(raw) && raw.length > 0) return raw.join(', ')
  if (typeof raw === 'string' && raw.trim()) return raw
  if (status >= 500) return 'שגיאת שרת, נסה שוב מאוחר יותר'
  return 'הבקשה נכשלה, נסה שוב'
}

// Single place that talks to the backend. The API identifies the caller with
// the `x-user-id` header, so it is attached whenever a user is signed in.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const userId = getCurrentUserId()

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('לא ניתן להתחבר לשרת. בדוק את החיבור לאינטרנט ונסה שוב', 0)
  }

  const body = (await response.json().catch(() => null)) as (ApiErrorBody & T) | null

  if (!response.ok) {
    throw new ApiError(messageFor(response.status, body), response.status, body?.issues ?? [])
  }

  return body as T
}
