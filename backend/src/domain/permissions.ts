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

export function canAccessMador(
  access: AccessProfile,
  targetMador: string | null,
  targetUnitCode?: string | null,
): boolean {
  return (
    access.role === UserRole.admin ||
    access.accessMador === targetMador ||
    (access.role === UserRole.poc &&
      Boolean(access.accessUnitCode) &&
      access.accessUnitCode === targetUnitCode)
  );
}

export function assertCanAccessMador(
  access: AccessProfile,
  targetMador: string | null,
  targetUnitCode?: string | null,
): void {
  if (!canAccessMador(access, targetMador, targetUnitCode)) {
    throw new ForbiddenException('אין לך הרשאה לפעול במדור שנבחר');
  }
}

export function assertCanCreatePackingUnit(
  access: AccessProfile,
  targetMador: string | null,
  targetUnitCode?: string | null,
): void {
  if (!access.canCreatePackingUnits || !canAccessMador(access, targetMador, targetUnitCode)) {
    throw new ForbiddenException('אין לך הרשאה ליצור יחידת אריזה במדור שנבחר');
  }
}

export function assertCanCreateShipment(
  access: AccessProfile,
  targetMador: string | null,
  targetUnitCode?: string | null,
): void {
  if (!access.canCreateShipments || !canAccessMador(access, targetMador, targetUnitCode)) {
    throw new ForbiddenException('אין לך הרשאה ליצור הובלה במדור שנבחר');
  }
}
