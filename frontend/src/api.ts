export interface ContextUser {
  id: string
  email: string
  role: string
  unit?: string | null
  anaf?: string | null
  mador: string | null
  team: string | null
  orgScopeId: string | null
  orgCode?: string | null
}

export interface OrgScope {
  id: string
  orgCode?: string | null
  unit: string | null
  anaf: string | null
  mador: string | null
  team: string | null
  unitCode?: string
  anafCode?: string
  madorCode?: string
  teamCode?: string
}

export interface AppContext {
  authMode: string
  users: ContextUser[]
  scopes: OrgScope[]
}

export interface SourceRoom {
  roomId: string
  description: string | null
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

export interface RoomMappingStatus {
  roomId: string | null
  exists: boolean
  completed: boolean
  source: string
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

export interface CreatePackingUnitRequest {
  idempotencyKey: string
  orgScopeId: string
  description: string
  packingUnitType:
    | 'personal_carton'
    | 'professional_carton'
    | 'pallet'
    | 'dolav'
    | 'bulk'
  sourceRoomId: string
  destination:
    | { mode: 'existing'; destinationId: string }
    | { mode: 'new'; description: string; building: string; floor: string; room: string }
  items: Array<{ itemId: string; quantity: number }>
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
  items: Array<{ id: string; description: string; quantity: number }>
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const CONFIGURED_API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const API_BASE = `${CONFIGURED_API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '')}/api`

async function request<T>(path: string, options: RequestInit = {}, userId?: string): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (userId) headers.set('x-user-id', userId)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('לא ניתן להתחבר לשרת. נסה שוב.', 0)
  }

  const body = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | T
    | null
  if (!response.ok) {
    const message = (body as { message?: string | string[] } | null)?.message
    throw new ApiError(
      Array.isArray(message) ? message.join(' ') : message || 'אירעה שגיאה בשרת.',
      response.status,
    )
  }
  return body as T
}

export const api = {
  getContext: () => request<AppContext>('/context'),
  getSourceRooms: (userId: string, orgScopeId: string) =>
    request<SourceRoom[]>(`/packing-units/source-rooms?orgScopeId=${encodeURIComponent(orgScopeId)}`, {}, userId),
  getMappingStatus: (userId: string, orgScopeId: string, sourceRoomId: string) =>
    request<RoomMappingStatus>(
      `/packing-units/mapping-status?orgScopeId=${encodeURIComponent(orgScopeId)}&sourceRoomId=${encodeURIComponent(sourceRoomId)}`,
      {},
      userId,
    ),
  getSourceRoom: (userId: string, orgScopeId: string, roomId: string) =>
    request<SourceRoomDetails>(
      `/packing-units/source-room?orgScopeId=${encodeURIComponent(orgScopeId)}&roomId=${encodeURIComponent(roomId)}`,
      {},
      userId,
    ),
  getEligibleItems: (userId: string, orgScopeId: string, sourceRoomId: string) =>
    request<EligibleItem[]>(
      `/packing-units/eligible-items?orgScopeId=${encodeURIComponent(orgScopeId)}&sourceRoomId=${encodeURIComponent(sourceRoomId)}`,
      {},
      userId,
    ),
  searchDestinations: (userId: string, orgScopeId: string, search: string) =>
    request<Destination[]>(
      `/destinations?orgScopeId=${encodeURIComponent(orgScopeId)}&search=${encodeURIComponent(search)}`,
      {},
      userId,
    ),
  createPackingUnit: (userId: string, body: CreatePackingUnitRequest) =>
    request<PackingSuccessResponse>('/packing-units', {
      method: 'POST',
      body: JSON.stringify(body),
    }, userId),
}
