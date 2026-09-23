const CONFIGURED_API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const BASE_URL = CONFIGURED_API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '')

function headers(userId: string) {
  return { 'Content-Type': 'application/json', 'x-user-id': userId }
}

export interface EligiblePackingUnit {
  id: string
  description: string
  serialNumber: number | null
  displaySerial: string
  packingUnitType: string | null
  sourceDescription: string | null
  destinationDescription: string | null
  items: { id: string; description: string; quantity: number }[]
}

export interface CreateShipmentPayload {
  idempotencyKey: string
  orgScopeId: string
  description: string
  transportType: 'truck' | 'other'
  transportDescription?: string
  vehicleIdentifier: string
  transportAt: string
  packingUnitIds: string[]
}

export interface Shipment {
  id: string
  description: string
  status: string
  vehicleIdentifier: string | null
  transportType: string | null
  transportAt: string | null
  packingUnits: { id: string; description: string; serialNumber: number | null }[]
}

export async function fetchEligiblePackingUnits(
  orgScopeId: string,
  userId: string,
): Promise<EligiblePackingUnit[]> {
  const url = `${BASE_URL}/api/packing-units/eligible-for-shipment?orgScopeId=${encodeURIComponent(orgScopeId)}`
  const res = await fetch(url, { headers: headers(userId) })
  if (!res.ok) throw new Error(`Eligible packing units fetch failed: ${res.status}`)
  return res.json()
}

export async function createShipment(
  payload: CreateShipmentPayload,
  userId: string,
): Promise<Shipment> {
  const res = await fetch(`${BASE_URL}/api/shipments`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Shipment creation failed: ${res.status}`)
  }
  return res.json()
}

export interface AdminUserView {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  personalNumber: string | null
  role: 'admin' | 'poc' | 'normal'
  orgCode: string | null
  orgNames: { unit: string; anaf: string; mador: string; team: string } | null
}

export interface PocShipment {
  id: string
  description: string
  status: string
  transportAt: string | null
  orgScope: { mador: string; orgCode: string | null }
  packingUnits: {
    id: string
    description: string
    status: string
    serialNumber: number | null
    items: { id: string; description: string; quantity: number; status: string }[]
  }[]
}

export interface PocDashboard {
  shipments: PocShipment[]
  pending: PocShipment[]
  verified: PocShipment[]
}

export async function fetchAdminUsers(userId: string): Promise<AdminUserView[]> {
  const res = await fetch(`${BASE_URL}/api/admin/users`, { headers: headers(userId) })
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`)
  return res.json()
}

export async function setUserRole(
  targetUserId: string,
  role: 'poc' | 'normal',
  actorUserId: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/users/${targetUserId}/role`, {
    method: 'PATCH',
    headers: headers(actorUserId),
    body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Role update failed: ${res.status}`)
  }
}

export async function fetchPocDashboard(userId: string): Promise<PocDashboard> {
  const res = await fetch(`${BASE_URL}/api/poc/dashboard`, { headers: headers(userId) })
  if (!res.ok) throw new Error(`Failed to fetch POC dashboard: ${res.status}`)
  return res.json()
}

export async function verifyShipment(shipmentId: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/poc/shipments/${shipmentId}/verify`, {
    method: 'POST',
    headers: headers(userId),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Verification failed: ${res.status}`)
  }
}
