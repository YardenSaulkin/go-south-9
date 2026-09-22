const PERSONAL_NUMBER_RE = /^\d{7}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validatePersonalNumber(value: string): string | null {
  const v = value.trim()
  if (!v) return 'יש להזין מספר אישי'
  if (!/^\d+$/.test(v)) return 'מספר אישי יכול להכיל ספרות בלבד'
  if (!PERSONAL_NUMBER_RE.test(v)) return 'מספר אישי חייב להכיל 7 ספרות'
  return null
}

export function validateEmail(value: string): string | null {
  const v = value.trim()
  if (!v) return 'יש להזין אימייל'
  if (!EMAIL_RE.test(v)) return 'כתובת אימייל לא תקינה'
  return null
}

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `יש להזין ${label}`
}

export function hasErrors(errors: Record<string, string | null>): boolean {
  return Object.values(errors).some(Boolean)
}
