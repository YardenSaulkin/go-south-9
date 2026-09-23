import { apiFetch } from './client'

export type PackingUnitType =
  | 'personal_carton'
  | 'professional_carton'
  | 'pallet'
  | 'dolav'
  | 'bulk'

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
  description: string | null
  orgCode?: string | null
  unit?: string | null
  anaf?: string | null
  team?: string | null
  unitCode?: string | null
  anafCode?: string | null
  madorCode?: string | null
  teamCode?: string | null
}

export interface AppContext {
  user?: ContextUser
  scopes: OrgScope[]
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

export interface RoomMappingStatus {
  roomId: string | null
  exists: boolean
  completed: boolean
  source: string
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
  description: string
  hasHistoricalDescriptionCollision?: boolean
}

export interface CreatePackingUnitRequest {
  idempotencyKey: string
  orgScopeId: string
  description: string
  packingUnitType: PackingUnitType
  sourceRoomId: string
  destination:
    | { mode: 'existing'; destinationId: string }
    | {
        mode: 'new'
        destinationId: string
        description: string
        building: string
        floor: string
        room: string
      }
  items: { itemId: string; quantity: number }[]
}

export interface ResponsiblePerson {
  name: string
  phone: string | null
}

export interface PackingSuccessResponse {
  packingUnit: {
    id: string
    description: string
    serialNumber: number | null
    displaySerial: string | null
    type: PackingUnitType | null
    status: string
    itemCount: number
  }
  source: {
    orgScopeId: string
    unit: string | null
    anaf: string | null
    mador: string | null
    team: string | null
    roomId: string | null
    roomDisplayName?: string | null
    description: string | null
  }
  destination: {
    id: string | null
    description: string | null
    building?: string | null
    floor?: string | null
    room?: string | null
  }
  responsiblePeople: {
    mador: ResponsiblePerson | null
    room: ResponsiblePerson | null
    packer: {
      userId: string
      firstName: string | null
      lastName: string | null
      personalNumber: string | null
      email: string
      displayName: string
    }
  }
  items: { id: string; description: string; quantity: number }[]
}

function packingQuery(path: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params)
  return `/api${path}?${search.toString()}`
}

export const packingApi = {
  getContext: () => apiFetch<AppContext>('/api/context'),
  getSourceRooms: (orgScopeId: string) =>
    apiFetch<SourceRoom[]>(packingQuery('/packing-units/source-rooms', { orgScopeId })),
  getSourceRoom: (orgScopeId: string, roomId: string) =>
    apiFetch<SourceRoomDetails>(packingQuery('/packing-units/source-room', { orgScopeId, roomId })),
  getEligibleItems: (orgScopeId: string, sourceRoomId: string) =>
    apiFetch<EligibleItem[]>(packingQuery('/packing-units/eligible-items', { orgScopeId, sourceRoomId })),
  searchDestinations: (orgScopeId: string, search: string, sourceRoomId?: string) =>
    apiFetch<Destination[]>(packingQuery('/destinations', {
      orgScopeId,
      search,
      ...(sourceRoomId ? { sourceRoomId } : {}),
    })),
  createPackingUnit: (body: CreatePackingUnitRequest) =>
    apiFetch<PackingSuccessResponse>('/api/packing-units', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
