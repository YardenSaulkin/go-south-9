const CONFIGURED_API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const BASE_URL = CONFIGURED_API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '')

function headers(userId: string) {
  return { 'Content-Type': 'application/json', 'x-user-id': userId }
}

export interface ContextUser {
  id: string
  email: string
  role: 'admin' | 'poc' | 'normal'
  orgScopeId: string | null
  orgCode: string | null
  firstName?: string | null
  lastName?: string | null
  personalNumber?: string | null
}

export interface OrgScope {
  id: string
  mador: string
  unit: string | null
  anaf: string | null
  team: string | null
  description: string | null
  orgCode?: string | null
  unitCode?: string
  anafCode?: string
  madorCode?: string
  teamCode?: string
}

export interface AppContext {
  user: ContextUser
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

export async function fetchContext(userId: string): Promise<AppContext> {
  const res = await fetch(`${BASE_URL}/api/context`, { headers: headers(userId) })
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
  sourceMappingReportId: string | null
  destinationDescription: string | null
}

export interface SourceRoom {
  roomId: string
  description: string | null
  exists: boolean
  completed: boolean
  source: string
}

export interface RoomMappingStatus {
  roomId: string | null
  exists: boolean
  completed: boolean
  source: string
}

export interface SourceRoomDetails {
  id: string
  description: string | null
  mappingStatus: RoomMappingStatus
  roomResponsible: string | null
  orgCode: string | null
}

export interface Destination {
  id: string
  destinationCode: string
  description: string
  building: string
  floor: string
  room: string
}

export interface CreatePackingUnitRequest {
  idempotencyKey: string
  orgScopeId: string
  description: string
  packingUnitType: 'personal_carton' | 'professional_carton' | 'pallet' | 'dolav' | 'bulk'
  sourceRoomId: string
  destination:
    | { mode: 'existing'; destinationId: string }
    | { mode: 'new'; description: string; building: string; floor: string; room: string }
  items: { itemId: string; quantity: number }[]
}

export interface PackingSuccessResponse {
  packingUnit: {
    id: string
    description: string
    serialNumber: number | null
    displaySerial: string | null
    type: CreatePackingUnitRequest['packingUnitType'] | null
    status: string
    itemCount: number
  }
  source: {
    orgScopeId: string
    unit: string | null
    anaf: string | null
    mador: string | null
    team: string | null
    room: string | null
    sourceDescription: string | null
    roomResponsible: string | null
  }
  destination: {
    building: string
    floor: string
    room: string
    id: string | null
    code: string
    description: string
  }
  responsibilities: {
    madorResponsible: string
    roomResponsible: string
    packer: string
  }
  items: { id: string; description: string; quantity: number }[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function packingRequest<T>(path: string, userId: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      ...init,
      headers: { ...headers(userId), ...init.headers },
    })
  } catch {
    throw new ApiError('לא ניתן להתחבר לשרת. נסה שוב.', 0)
  }

  const body = await res.json().catch(() => null) as { message?: string | string[] } | T | null
  if (!res.ok) {
    const message = (body as { message?: string | string[] } | null)?.message
    throw new ApiError(Array.isArray(message) ? message.join(' ') : message || 'אירעה שגיאה בשרת.', res.status)
  }
  return body as T
}

export const packingApi = {
  getContext: (userId: string) => fetchContext(userId),
  getSourceRooms: (userId: string, orgScopeId: string) =>
    packingRequest<SourceRoom[]>(`/packing-units/source-rooms?orgScopeId=${encodeURIComponent(orgScopeId)}`, userId),
  getMappingStatus: (userId: string, orgScopeId: string, sourceRoomId: string) =>
    packingRequest<RoomMappingStatus>(`/packing-units/mapping-status?orgScopeId=${encodeURIComponent(orgScopeId)}&sourceRoomId=${encodeURIComponent(sourceRoomId)}`, userId),
  getSourceRoom: (userId: string, orgScopeId: string, roomId: string) =>
    packingRequest<SourceRoomDetails>(`/packing-units/source-room?orgScopeId=${encodeURIComponent(orgScopeId)}&roomId=${encodeURIComponent(roomId)}`, userId),
  getEligibleItems: (userId: string, orgScopeId: string, sourceRoomId: string) =>
    packingRequest<EligibleItem[]>(`/packing-units/eligible-items?orgScopeId=${encodeURIComponent(orgScopeId)}&sourceRoomId=${encodeURIComponent(sourceRoomId)}`, userId),
  searchDestinations: (userId: string, orgScopeId: string, search: string) =>
    packingRequest<Destination[]>(`/destinations?orgScopeId=${encodeURIComponent(orgScopeId)}&search=${encodeURIComponent(search)}`, userId),
  createPackingUnit: (userId: string, body: CreatePackingUnitRequest) =>
    packingRequest<PackingSuccessResponse>('/packing-units', userId, { method: 'POST', body: JSON.stringify(body) }),
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
