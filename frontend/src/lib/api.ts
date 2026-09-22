const BASE_URL = 'http://localhost:3000'

function headers(userId: string) {
  return { 'Content-Type': 'application/json', 'x-user-id': userId }
}

export interface DemoUser {
  id: string
  email: string
  role: string
  mador: string | null
  team: string | null
  orgScopeId: string | null
}

export interface OrgScope {
  id: string
  mador: string
  unit: string | null
  anaf: string | null
  team: string | null
  description: string | null
}

export interface AppContext {
  authMode: string
  users: DemoUser[]
  scopes: OrgScope[]
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

export async function fetchContext(): Promise<AppContext> {
  const res = await fetch(`${BASE_URL}/api/context`)
  if (!res.ok) throw new Error(`Context fetch failed: ${res.status}`)
  return res.json()
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

export interface EligibleItem {
  id: string
  description: string
  quantity: number
  sourceRoomId: string | null
  sourceDescription: string | null
}

export interface CreatePackingUnitPayload {
  idempotencyKey: string
  orgScopeId: string
  description: string
  packingUnitType: string
  sourceRoomId?: string
  sourceDescription?: string
  destination: { building: string; floor: string; room: string }
  items: { itemId: string; quantity: number }[]
}

export interface PackingUnit {
  id: string
  description: string
  displaySerial: string
  serialNumber: number | null
  items: { id: string; description: string; quantity: number }[]
}

export async function fetchEligibleItems(
  orgScopeId: string,
  userId: string,
): Promise<EligibleItem[]> {
  const url = `${BASE_URL}/api/packing-units/eligible-items?orgScopeId=${encodeURIComponent(orgScopeId)}`
  const res = await fetch(url, { headers: headers(userId) })
  if (!res.ok) throw new Error(`Eligible items fetch failed: ${res.status}`)
  return res.json()
}

export async function createPackingUnit(
  payload: CreatePackingUnitPayload,
  userId: string,
): Promise<PackingUnit> {
  const res = await fetch(`${BASE_URL}/api/packing-units`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Packing unit creation failed: ${res.status}`)
  }
  return res.json()
}
