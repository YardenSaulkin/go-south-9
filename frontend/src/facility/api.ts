import { apiFetch } from '../api/client'

// Every call goes through the shared apiFetch, so facility mode inherits the
// same base URL, the `x-user-id` header and the Hebrew error handling the rest
// of the app uses.

export type ReportCategory =
  | 'office_equipment'
  | 'air_conditioning'
  | 'lighting'
  | 'electricity'
  | 'plumbing'
  | 'network'
  | 'furniture'
  | 'cleaning'
  | 'other'

export type ReportUrgency = 'low' | 'medium' | 'high'
export type ReportStatus = 'open' | 'assigned' | 'in_progress' | 'resolved'

export interface PhotoAnalysis {
  objectLabel: string
  issueDescription: string
  category: ReportCategory
  urgency: ReportUrgency
  locationDescription: string
  confidence: number
  assignedTeam: string
  expectedResponseHours: number
  // 'unavailable' means no model looked at the photo — the review screen then
  // asks the user to fill the details in instead of showing empty findings.
  source: 'ai' | 'unavailable'
}

export interface FacilityReport {
  id: string
  reportNumber: number
  objectLabel: string
  issueDescription: string
  category: ReportCategory
  urgency: ReportUrgency
  status: ReportStatus
  locationDescription: string | null
  assignedTeam: string
  expectedResponseHours: number
  aiConfidence: number | null
  createdAt: string
  dueAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
  categoryLabel: string
  urgencyLabel: string
  statusLabel: string
  room: { id: string; name: string; building: string; floor: string } | null
  reportedBy: {
    id: string
    firstName: string | null
    lastName: string | null
    personalNumber: string | null
  } | null
}

export interface CreateReportPayload {
  idempotencyKey: string
  objectLabel: string
  issueDescription: string
  category: ReportCategory
  urgency: ReportUrgency
  locationDescription?: string
  roomId?: string
  photo?: string
  aiConfidence?: number
  aiAnalysis?: Record<string, unknown>
}

export interface Room {
  id: string
  name: string
  building: string
  floor: string
  capacity: number
  features: string[]
  imageUrl: string | null
  description: string | null
  isAvailable: boolean
}

export interface Reservation {
  id: string
  startAt: string
  endAt: string
  title: string | null
  userId: string
}

export interface RoomAvailability {
  room: Omit<Room, 'isAvailable'>
  reservations: Reservation[]
}

export interface RoomSearchCriteria {
  q?: string
  minCapacity?: number
  maxCapacity?: number
  features?: string[]
  startAt?: string
  endAt?: string
}

export interface FacilityInsights {
  windowDays: number
  generatedAt: string
  roomCount: number
  occupancy: { rate: number; changePercent: number | null }
  reports: { total: number; open: number; resolved: number; changePercent: number | null }
  responseTime: { averageHours: number; changePercent: number | null; sampleSize: number }
  heatmap: { days: number[]; hours: number[]; cells: number[][] }
  categories: { category: ReportCategory; label: string; count: number; percent: number }[]
  busiestRooms: { roomId: string; name: string; bookedHours: number }[]
}

export function analyzePhoto(photo: string, note?: string): Promise<PhotoAnalysis> {
  return apiFetch<PhotoAnalysis>('/api/facility/reports/analyze', {
    method: 'POST',
    body: JSON.stringify({ photo, note }),
  })
}

export function createReport(payload: CreateReportPayload): Promise<FacilityReport> {
  return apiFetch<FacilityReport>('/api/facility/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// 'all' returns every call in the compound and is allowed for admins only —
// the backend rejects it for anyone else.
export function fetchReports(scope: 'mine' | 'all' = 'mine'): Promise<FacilityReport[]> {
  return apiFetch<FacilityReport[]>(`/api/facility/reports?scope=${scope}`)
}

export function searchRooms(criteria: RoomSearchCriteria): Promise<Room[]> {
  const params = new URLSearchParams()
  if (criteria.q) params.set('q', criteria.q)
  if (criteria.minCapacity) params.set('minCapacity', String(criteria.minCapacity))
  if (criteria.maxCapacity) params.set('maxCapacity', String(criteria.maxCapacity))
  if (criteria.features?.length) params.set('features', criteria.features.join(','))
  if (criteria.startAt) params.set('startAt', criteria.startAt)
  if (criteria.endAt) params.set('endAt', criteria.endAt)

  const query = params.toString()
  return apiFetch<Room[]>(`/api/facility/rooms${query ? `?${query}` : ''}`)
}

export function fetchRoomAvailability(
  roomId: string,
  from: string,
  to: string,
): Promise<RoomAvailability> {
  const params = new URLSearchParams({ from, to })
  return apiFetch<RoomAvailability>(`/api/facility/rooms/${roomId}?${params}`)
}

export function reserveRoom(
  roomId: string,
  payload: { idempotencyKey: string; startAt: string; endAt: string; title?: string; attendees?: number },
): Promise<{ id: string; startAt: string; endAt: string }> {
  return apiFetch(`/api/facility/rooms/${roomId}/reservations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchInsights(days: number): Promise<FacilityInsights> {
  return apiFetch<FacilityInsights>(`/api/facility/insights?days=${days}`)
}
