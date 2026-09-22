import { BadRequestException, ConflictException } from '@nestjs/common';
import { ItemStatus, PackingUnitStatus, ShipmentStatus } from '@prisma/client';

const shipmentTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  not_sent: [ShipmentStatus.sent],
  sent: [ShipmentStatus.arrived],
  arrived: [ShipmentStatus.verified],
  verified: [],
};

const packingUnitTransitions: Record<PackingUnitStatus, PackingUnitStatus[]> = {
  not_sent: [PackingUnitStatus.assigned_to_shipment],
  assigned_to_shipment: [PackingUnitStatus.in_transit],
  in_transit: [PackingUnitStatus.arrived_pending_verification],
  arrived_pending_verification: [PackingUnitStatus.verified],
  verified: [],
};

const itemTransitions: Record<ItemStatus, ItemStatus[]> = {
  not_sent: [ItemStatus.assigned_to_packing_unit],
  assigned_to_packing_unit: [ItemStatus.in_transit],
  in_transit: [ItemStatus.arrived_pending_verification],
  arrived_pending_verification: [ItemStatus.verified],
  verified: [],
};

export function assertShipmentTransition(
  previous: ShipmentStatus,
  next: ShipmentStatus,
): void {
  if (!shipmentTransitions[previous].includes(next)) {
    throw new BadRequestException(`מעבר הובלה לא חוקי: ${previous} → ${next}`);
  }
}

export function assertPackingUnitTransition(
  previous: PackingUnitStatus,
  next: PackingUnitStatus,
): void {
  if (!packingUnitTransitions[previous].includes(next)) {
    throw new BadRequestException(
      `מעבר יחידת אריזה לא חוקי: ${previous} → ${next}`,
    );
  }
}

export function assertItemTransition(
  previous: ItemStatus,
  next: ItemStatus,
): void {
  if (!itemTransitions[previous].includes(next)) {
    throw new BadRequestException(`מעבר פריט לא חוקי: ${previous} → ${next}`);
  }
}

export function assertPackingUnitCanVerify(childStatuses: ItemStatus[]): void {
  if (childStatuses.some((status) => status !== ItemStatus.verified)) {
    throw new ConflictException('לא ניתן לאמת יחידת אריזה עם פריטים שלא אומתו');
  }
}

export function assertShipmentCanVerify(
  childStatuses: PackingUnitStatus[],
): void {
  if (childStatuses.some((status) => status !== PackingUnitStatus.verified)) {
    throw new ConflictException('לא ניתן לאמת הובלה עם יחידות אריזה שלא אומתו');
  }
}

export function assertClaimSucceeded(updatedRows: number): void {
  if (updatedRows !== 1) {
    throw new ConflictException(
      'הפריט או יחידת האריזה השתנו בידי משתמש אחר. יש לרענן ולנסות שוב.',
    );
  }
}
