import { z } from 'zod';

const personalNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{7}$/, 'מספר אישי חייב להכיל 7 ספרות');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('כתובת אימייל לא תקינה')
  .max(200);

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, 'יש להזין שם פרטי').max(100),
  lastName: z.string().trim().min(1, 'יש להזין שם משפחה').max(100),
  personalNumber: personalNumberSchema,
  email: emailSchema,
  unit: z.string().trim().min(1, 'יש להזין יחידה').max(100),
  anaf: z.string().trim().min(1, 'יש להזין ענף').max(100),
  mador: z.string().trim().min(1, 'יש להזין מדור').max(100),
  team: z.string().trim().min(1, 'יש להזין צוות').max(100),
});

export const loginSchema = z.object({
  personalNumber: personalNumberSchema,
  email: emailSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
