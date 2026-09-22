import { ConflictException } from '@nestjs/common';

export function summarizeReceiving(
  expectedIds: string[],
  arrivedIds: string[],
) {
  const arrived = new Set(arrivedIds);
  if (arrived.size !== arrivedIds.length) {
    throw new ConflictException('יחידת אריזה סומנה יותר מפעם אחת');
  }
  if (arrivedIds.some((id) => !expectedIds.includes(id))) {
    throw new ConflictException('סומנה יחידת אריזה שאינה שייכת להובלה');
  }

  const missingIds = expectedIds.filter((id) => !arrived.has(id));
  return {
    expectedCount: expectedIds.length,
    receivedCount: arrivedIds.length,
    missingCount: missingIds.length,
    arrivedIds,
    missingIds,
  };
}
