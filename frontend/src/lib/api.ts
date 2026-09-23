const CONFIGURED_API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const BASE_URL = CONFIGURED_API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

function headers(userId: string) {
  return { "Content-Type": "application/json", "x-user-id": userId };
}

export interface DemoUser {
  id: string;
  email: string;
  role: "admin" | "poc" | "normal";
  orgScopeId: string | null;
  orgCode: string | null;
  firstName?: string | null;
  lastName?: string | null;
  personalNumber?: string | null;
}

export interface OrgScope {
  id: string;
  mador: string;
  description: string | null;
}

export interface AppContext {
  authMode: string;
  users: DemoUser[];
  scopes: OrgScope[];
}

export interface EligiblePackingUnit {
  id: string;
  description: string;
  serialNumber: number | null;
  displaySerial: string;
  packingUnitType: string | null;
  sourceDescription: string | null;
  destinationDescription: string | null;
  items: { id: string; description: string; quantity: number }[];
}

export interface CreateShipmentPayload {
  idempotencyKey: string;
  orgScopeId: string;
  description: string;
  transportType: "truck" | "other";
  transportDescription?: string;
  vehicleIdentifier: string;
  transportAt: string;
  packingUnitIds: string[];
}

export interface Shipment {
  id: string;
  description: string;
  status: string;
  vehicleIdentifier: string | null;
  transportType: string | null;
  transportAt: string | null;
  packingUnits: {
    id: string;
    description: string;
    serialNumber: number | null;
  }[];
}

export async function fetchEligiblePackingUnits(
  orgScopeId: string,
  userId: string,
): Promise<EligiblePackingUnit[]> {
  const url = `${BASE_URL}/api/packing-units/eligible-for-shipment?orgScopeId=${encodeURIComponent(orgScopeId)}`;
  const res = await fetch(url, { headers: headers(userId) });
  if (!res.ok)
    throw new Error(`Eligible packing units fetch failed: ${res.status}`);
  return res.json();
}

export async function createShipment(
  payload: CreateShipmentPayload,
  userId: string,
): Promise<Shipment> {
  const res = await fetch(`${BASE_URL}/api/shipments`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        `Shipment creation failed: ${res.status}`,
    );
  }
  return res.json();
}

export interface AdminUserView {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  personalNumber: string | null;
  role: "admin" | "poc" | "normal";
  orgCode: string | null;
}

export interface PocShipment {
  id: string;
  description: string;
  status: string;
  transportAt: string | null;
  orgScope: { mador: string; orgCode: string | null };
  packingUnits: {
    id: string;
    description: string;
    status: string;
    serialNumber: number | null;
    items: {
      id: string;
      description: string;
      quantity: number;
      status: string;
    }[];
  }[];
}

export interface PocDashboard {
  shipments: PocShipment[];
  pending: PocShipment[];
  verified: PocShipment[];
  unitNames?: Record<string, string>;
}

export async function fetchAdminUsers(
  userId: string,
): Promise<AdminUserView[]> {
  const res = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: headers(userId),
  });
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}

export async function setUserRole(
  targetUserId: string,
  role: "poc" | "normal",
  actorUserId: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/users/${targetUserId}/role`, {
    method: "PATCH",
    headers: headers(actorUserId),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        `Role update failed: ${res.status}`,
    );
  }
}

export async function fetchPocDashboard(userId: string): Promise<PocDashboard> {
  const res = await fetch(`${BASE_URL}/api/poc/dashboard`, {
    headers: headers(userId),
  });
  if (!res.ok) throw new Error(`Failed to fetch POC dashboard: ${res.status}`);
  return res.json();
}

export async function confirmShipmentArrival(
  shipmentId: string,
  userId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/poc/shipments/${shipmentId}/confirm-arrival`,
    {
      method: "POST",
      headers: headers(userId),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        `Confirmation failed: ${res.status}`,
    );
  }
}

// ─── Shipments Status (סטטוס הובלות) — all roles ─────────────────────────────

export async function fetchShipmentsStatus(
  userId: string,
): Promise<PocDashboard> {
  const res = await fetch(`${BASE_URL}/api/status/shipments`, {
    headers: headers(userId),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch shipments status: ${res.status}`);
  return res.json();
}

// ─── Packing Units Status (סטטוס אריזות) ─────────────────────────────────────

export interface StatusPackingUnit {
  id: string;
  serialNumber: number | null;
  displaySerial: string;
  description: string;
  status: string;
  packingUnitType: string | null;
  orgScope?: { mador: string; orgCode: string | null } | null;
}

export interface PackingUnitsStatus {
  packingUnits: StatusPackingUnit[];
  unitNames?: Record<string, string>;
}

export async function fetchPackingUnitsStatus(
  userId: string,
): Promise<PackingUnitsStatus> {
  const res = await fetch(`${BASE_URL}/api/status/packing-units`, {
    headers: headers(userId),
  });
  if (!res.ok)
    throw new Error(`Failed to fetch packing units status: ${res.status}`);
  return res.json();
}

// ─── Distribution (פיזור ציוד) ────────────────────────────────────────────────

export interface DistributionItem {
  id: string;
  description: string;
  quantity: number;
  distributedQuantity: number;
  status: string;
}

export interface DistributionPackingUnit {
  id: string;
  serialNumber: number | null;
  displaySerial: string;
  description: string;
  status: string;
  packingUnitType?: string | null;
  sourceDescription: string | null;
  destinationDescription: string | null;
  items: DistributionItem[];
  orgScope?: {
    id?: string;
    mador: string;
  } | null;
  createdBy?: {
    firstName?: string | null;
    lastName?: string | null;
    personalNumber?: string | null;
  } | null;
  packerName?: string;
}

export interface DistributePayload {
  idempotencyKey: string;
  finalConfirmation: boolean;
  items: { itemId: string; actualQuantity: number }[];
}

export async function fetchDistributionPackingUnits(
  orgScopeId: string | null,
  userId: string,
): Promise<DistributionPackingUnit[]> {
  const params = orgScopeId
    ? `?orgScopeId=${encodeURIComponent(orgScopeId)}`
    : "";
  const res = await fetch(
    `${BASE_URL}/api/distribution/packing-units${params}`,
    {
      headers: headers(userId),
    },
  );
  if (!res.ok)
    throw new Error(`Distribution units fetch failed: ${res.status}`);
  return res.json();
}

export async function distributePackingUnit(
  packingUnitId: string,
  payload: DistributePayload,
  userId: string,
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/api/distribution/${packingUnitId}`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        `Distribute failed: ${res.status}`,
    );
  }
  return res.json();
}

// ─── Receiving (קבלת ציוד) ─────────────────────────────────────────────────

export type PackingUnitStatus =
  | "not_sent"
  | "assigned_to_shipment"
  | "in_transit"
  | "arrived_pending_verification"
  | "verified";

export interface ReceivingPackingUnit {
  id: string;
  description: string;
  status: PackingUnitStatus;
  serialNumber: number | null;
  displaySerial: string | null;
  packingUnitType: string | null;
  sourceDescription: string | null;
  destinationDescription: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    status: string;
  }[];
}

export interface ReceivingShipment {
  id: string;
  description: string;
  status: string;
  vehicleIdentifier: string | null;
  transportType: string | null;
  transportDescription: string | null;
  transportAt: string | null;
  sourceDescription: string | null;
  destinationDescription: string | null;
  packingUnits: ReceivingPackingUnit[];
}

// What the backend reports after a receiving pass: the shipment as it now
// stands, plus whatever is still unaccounted for.
export interface ReceivingResult {
  shipment: ReceivingShipment;
  shipmentStatus: string;
  expectedCount: number;
  receivedCount: number;
  missingCount: number;
  remainingPackingUnits: ReceivingPackingUnit[];
  finalized: boolean;
}

export async function fetchReceivingShipments(
  userId: string,
): Promise<ReceivingShipment[]> {
  const res = await fetch(`${BASE_URL}/api/receiving/shipments`, {
    headers: headers(userId),
  });
  if (!res.ok)
    throw new Error(`Receiving shipments fetch failed: ${res.status}`);
  return res.json();
}

export async function receivePackingUnits(
  shipmentId: string,
  packingUnitIds: string[],
  userId: string,
): Promise<ReceivingResult> {
  const res = await fetch(
    `${BASE_URL}/api/receiving/${shipmentId}/packing-units`,
    {
      method: "POST",
      headers: headers(userId),
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        packingUnitIds,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        `Receiving update failed: ${res.status}`,
    );
  }
  return res.json();
}
