import { BadRequestException } from '@nestjs/common';

export interface QuantitySplit {
  selected: number;
  remaining: number;
  isFullQuantity: boolean;
}

export function planQuantitySplit(
  available: number,
  requested: number,
): QuantitySplit {
  if (!Number.isInteger(available) || available <= 0) {
    throw new BadRequestException('כמות זמינה חייבת להיות מספר שלם וחיובי');
  }
  if (!Number.isInteger(requested) || requested <= 0) {
    throw new BadRequestException('כמות לאריזה חייבת להיות מספר שלם וחיובי');
  }
  if (requested > available) {
    throw new BadRequestException('הכמות שנבחרה גדולה מהכמות הזמינה');
  }

  return {
    selected: requested,
    remaining: available - requested,
    isFullQuantity: requested === available,
  };
}

export function summarizeQuantities(expected: number, actual: number) {
  if (!Number.isInteger(actual) || actual < 0) {
    throw new BadRequestException('הכמות בפועל אינה תקינה');
  }
  if (actual > expected) {
    throw new BadRequestException(
      'נמצאה כמות עודפת. יש לעצור, לבדוק את הציוד ולדווח לאחראי.',
    );
  }

  return { expected, actual, missing: expected - actual };
}

export function formatSerial(serialNumber: number | null): string | null {
  return serialNumber === null ? null : String(serialNumber).padStart(5, '0');
}
