import { ReportCategory, ReportUrgency } from '@prisma/client';
import { z } from 'zod';
import { uuidSchema } from '../common/validation.js';

// Photos arrive as data URLs from the camera screen. The client downscales
// before uploading; the cap here is the last line of defence.
const MAX_PHOTO_CHARACTERS = 4_000_000;

export const photoSchema = z
  .string()
  .trim()
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'תמונה לא תקינה')
  .max(MAX_PHOTO_CHARACTERS, 'התמונה גדולה מדי, יש לצלם שוב');

export const analyzePhotoSchema = z.object({
  photo: photoSchema,
  note: z.string().trim().max(300).optional(),
  roomId: uuidSchema.optional(),
});

export type AnalyzePhotoInput = z.infer<typeof analyzePhotoSchema>;

export const createReportSchema = z.object({
  idempotencyKey: uuidSchema,
  objectLabel: z.string().trim().min(2, 'יש להזין את הפריט').max(200),
  issueDescription: z.string().trim().min(2, 'יש לתאר את התקלה').max(1000),
  category: z.nativeEnum(ReportCategory),
  urgency: z.nativeEnum(ReportUrgency),
  locationDescription: z.string().trim().max(300).optional(),
  roomId: uuidSchema.optional(),
  photo: photoSchema.optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiAnalysis: z.record(z.string(), z.unknown()).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

const isoInstantSchema = z.coerce.date();

export const roomSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  minCapacity: z.coerce.number().int().positive().max(500).optional(),
  maxCapacity: z.coerce.number().int().positive().max(500).optional(),
  // Comma separated so the filters survive a plain query string.
  features: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value.split(',').map((f) => f.trim()).filter(Boolean))
    .optional(),
  startAt: isoInstantSchema.optional(),
  endAt: isoInstantSchema.optional(),
});

export type RoomSearchInput = z.infer<typeof roomSearchSchema>;

export const roomAvailabilitySchema = z.object({
  from: isoInstantSchema,
  to: isoInstantSchema,
});

export type RoomAvailabilityInput = z.infer<typeof roomAvailabilitySchema>;

export const createReservationSchema = z
  .object({
    idempotencyKey: uuidSchema,
    startAt: isoInstantSchema,
    endAt: isoInstantSchema,
    title: z.string().trim().max(200).optional(),
    attendees: z.number().int().positive().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.endAt <= value.startAt) {
      context.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
      });
    }
  });

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const insightsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export type InsightsQueryInput = z.infer<typeof insightsQuerySchema>;
