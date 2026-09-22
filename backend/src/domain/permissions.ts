import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface AccessProfile {
  role: UserRole;
  accessMador: string | null;
  accessUnitCode: string | null;
  canCreateShipments: boolean;
  canCreatePackingUnits: boolean;
  canViewShipments: boolean;
  canViewPackingUnits: boolean;
  canViewGlobalShipmentsDashboard: boolean;
  canApproveShipments: boolean;
  dataVisibilityScope: string | null;
}

export function canAccessMador(access: AccessProfile, targetMador: string): boolean {
  return access.role === UserRole.admin || access.accessMador === targetMador;
}

export function canAccessOrgScope(
  access: AccessProfile,
  targetMador: string,
  targetOrgCode: string | null,
): boolean {
  if (access.role === UserRole.admin) return true;
  if (access.role === UserRole.poc && access.accessUnitCode && targetOrgCode) {
    return targetOrgCode.startsWith(access.accessUnitCode);
  }
  return access.accessMador === targetMador;
}

export function assertCanAccessMador(access: AccessProfile, targetMador: string): void {
  if (!canAccessMador(access, targetMador)) {
    throw new ForbiddenException('אין לך הרשאה לפעול במדור שנבחר');
  }
}

export function assertCanAccessOrgScope(
  access: AccessProfile,
  targetMador: string,
  targetOrgCode: string | null,
): void {
  if (!canAccessOrgScope(access, targetMador, targetOrgCode)) {
    throw new ForbiddenException('אין לך הרשאה לפעול במסגרת ארגונית זו');
  }
}

export function assertCanCreatePackingUnit(
  access: AccessProfile,
  targetMador: string,
  targetOrgCode?: string | null,
): void {
  if (!access.canCreatePackingUnits || !canAccessOrgScope(access, targetMador, targetOrgCode ?? null)) {
    throw new ForbiddenException('אין לך הרשאה ליצור יחידת אריזה במדור שנבחר');
  }
}

export function assertCanCreateShipment(
  access: AccessProfile,
  targetMador: string,
  targetOrgCode?: string | null,
): void {
  if (!access.canCreateShipments || !canAccessOrgScope(access, targetMador, targetOrgCode ?? null)) {
    throw new ForbiddenException('אין לך הרשאה ליצור הובלה במדור שנבחר');
  }
}

export function assertCanApproveShipment(
  access: AccessProfile,
  targetOrgCode: string | null,
): void {
  if (!access.canApproveShipments) {
    throw new ForbiddenException('רק קצין קישור רשאי לאשר הובלה');
  }
  if (
    access.role === UserRole.poc &&
    access.accessUnitCode &&
    targetOrgCode &&
    !targetOrgCode.startsWith(access.accessUnitCode)
  ) {
    throw new ForbiddenException('אין לך הרשאה לאשר הובלה של יחידה אחרת');
  }
}
