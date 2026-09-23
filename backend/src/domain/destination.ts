import { z } from 'zod';
import { uuidSchema } from '../common/validation.js';

export const destinationSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('existing'),
    destinationId: z.string().trim().min(1, 'יש לבחור יעד').max(200),
  }),
  z.object({
    mode: z.literal('new'),
    destinationId: z.string().trim().min(1, 'יש להזין מזהה יעד').max(200),
    description: z.string().trim().min(1, 'יש להזין תיאור יעד').max(300),
    building: z.string().trim().min(1, 'יש להזין בניין').max(100),
    floor: z.string().trim().min(1, 'יש להזין קומה').max(50),
    room: z.string().trim().min(1, 'יש להזין חדר').max(100),
  }),
]);

export type DestinationSelection = z.infer<typeof destinationSelectionSchema>;

export function normalizeDestinationId(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function formatDestinationDescription(input: {
  description: string;
  building: string;
  floor: string;
  room: string;
}): string {
  const location = `בניין ${input.building.trim()}, קומה ${input.floor.trim()}, חדר ${input.room.trim()}`;
  const description = input.description.trim();
  return description === location ? location : `${location} — ${description}`;
}

export const destinationSearchSchema = z.object({
  orgScopeId: uuidSchema,
  search: z.string().trim().max(100).optional().default(''),
  sourceRoomId: z.string().trim().max(200).optional(),
});
