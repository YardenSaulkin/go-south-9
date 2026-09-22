import { apiFetch } from './client'
import type { AuthenticatedUser } from '../auth/session'
import { setCurrentUser } from '../auth/session'

export interface LoginPayload {
  personalNumber: string
  email: string
}

export interface SignupPayload extends LoginPayload {
  firstName: string
  lastName: string
  unit: string
  anaf: string
  mador: string
  team: string
}

interface AuthResponse {
  user: AuthenticatedUser
}

async function authenticate(
  path: '/api/auth/login' | '/api/auth/signup',
  payload: LoginPayload | SignupPayload,
): Promise<AuthenticatedUser> {
  const { user } = await apiFetch<AuthResponse>(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setCurrentUser(user)
  return user
}

export function login(payload: LoginPayload): Promise<AuthenticatedUser> {
  return authenticate('/api/auth/login', payload)
}

export function signup(payload: SignupPayload): Promise<AuthenticatedUser> {
  return authenticate('/api/auth/signup', payload)
}
