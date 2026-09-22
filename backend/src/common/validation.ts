import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const uuidSchema = z.string().uuid('מזהה לא תקין');

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;

  throw new BadRequestException({
    message: 'הנתונים שנשלחו אינם תקינים',
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}
