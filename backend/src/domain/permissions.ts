import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface AccessProfile {
  role: UserRole;
  accessMador: string | null;
  canCreateShipments: boolean;
  canCreatePackingUnits: boolean;
  canViewShipments: boolean;
  canViewPackingUnits: boolean;
  canViewGlobalShipmentsDashboard: boolean;
  dataVisibilityScope: string | null;
}

export function canAccessMador(
  access: AccessProfile,
  targetMador: string,
): boolean {
  return (
    access.role === UserRole.super_user || access.accessMador === targetMador
  );
}

export function assertCanAccessMador(
  access: AccessProfile,
  targetMador: string,
): void {
  if (!canAccessMador(access, targetMador)) {
    throw new ForbiddenException('אין לך הרשאה לפעול במדור שנבחר');
  }
}

export function assertCanCreatePackingUnit(
  access: AccessProfile,
  targetMador: string,
): void {
  if (!access.canCreatePackingUnits || !canAccessMador(access, targetMador)) {
    throw new ForbiddenException('אין לך הרשאה ליצור יחידת אריזה במדור שנבחר');
  }
}

export function assertCanCreateShipment(
  access: AccessProfile,
  targetMador: string,
): void {
  if (!access.canCreateShipments || !canAccessMador(access, targetMador)) {
    throw new ForbiddenException('אין לך הרשאה ליצור הובלה במדור שנבחר');
  }
}
