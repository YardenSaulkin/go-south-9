import { z } from 'zod';
import { uuidSchema } from '../common/validation.js';

export const destinationSelectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('existing'),
    destinationId: uuidSchema,
  }),
  z.object({
    mode: z.literal('new'),
    description: z.string().trim().min(1, 'יש להזין תיאור יעד').max(300),
    building: z.string().trim().min(1, 'יש להזין בניין').max(100),
    floor: z.string().trim().min(1, 'יש להזין קומה').max(50),
    room: z.string().trim().min(1, 'יש להזין חדר').max(100),
  }),
]);

export type DestinationSelection = z.infer<typeof destinationSelectionSchema>;

export const destinationSearchSchema = z.object({
  orgScopeId: uuidSchema,
  search: z.string().trim().max(100).optional().default(''),
});
