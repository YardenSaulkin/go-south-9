import { PackingUnitType, TransportType } from '@prisma/client';
import { z } from 'zod';
import { uuidSchema } from '../common/validation.js';

export const destinationSchema = z.object({
  building: z.string().trim().min(1, 'יש להזין בניין').max(100),
  floor: z.string().trim().min(1, 'יש להזין קומה').max(50),
  room: z.string().trim().min(1, 'יש להזין חדר').max(100),
  roomId: z.string().trim().max(200).optional(),
});

export const createPackingUnitSchema = z
  .object({
    idempotencyKey: uuidSchema,
    orgScopeId: uuidSchema,
    description: z.string().trim().min(2, 'יש להזין תיאור').max(300),
    packingUnitType: z.nativeEnum(PackingUnitType),
    sourceRoomId: z.string().trim().max(200).optional(),
    sourceDescription: z.string().trim().max(300).optional(),
    destination: destinationSchema,
    items: z
      .array(
        z.object({
          itemId: uuidSchema,
          quantity: z.number().int().positive(),
        }),
      )
      .max(500),
  })
  .superRefine((value, context) => {
    if (
      value.packingUnitType !== PackingUnitType.personal_carton &&
      value.items.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'יש לבחור לפחות פריט אחד ליחידת אריזה זו',
      });
    }
  });

export type CreatePackingUnitInput = z.infer<typeof createPackingUnitSchema>;

export const createShipmentSchema = z
  .object({
    idempotencyKey: uuidSchema,
    orgScopeId: uuidSchema,
    description: z.string().trim().min(2).max(300),
    transportType: z.nativeEnum(TransportType),
    transportDescription: z.string().trim().max(300).optional(),
    vehicleIdentifier: z.string().trim().min(2).max(100),
    transportAt: z.coerce.date(),
    destination: destinationSchema.optional(),
    packingUnitIds: z.array(uuidSchema).min(1, 'יש לבחור יחידת אריזה'),
  })
  .superRefine((value, context) => {
    if (
      value.transportType === TransportType.other &&
      !value.transportDescription
    ) {
      context.addIssue({
        code: 'custom',
        path: ['transportDescription'],
        message: 'יש לתאר את אמצעי ההובלה',
      });
    }
  });

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export const receivingSchema = z.object({
  idempotencyKey: uuidSchema,
  arrivedPackingUnitIds: z.array(uuidSchema),
  finalConfirmation: z.boolean(),
});

export type ReceivingInput = z.infer<typeof receivingSchema>;

export const distributionSchema = z.object({
  idempotencyKey: uuidSchema,
  finalConfirmation: z.boolean(),
  items: z.array(
    z.object({
      itemId: uuidSchema,
      actualQuantity: z.number().int().nonnegative(),
    }),
  ),
});

export type DistributionInput = z.infer<typeof distributionSchema>;
