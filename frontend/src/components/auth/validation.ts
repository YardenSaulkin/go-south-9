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

export function validateOrgCode(value: string, label: string): string | null {
  const v = value.trim()
  if (!v) return `יש להזין קוד ${label}`
  if (!/^\d{2}$/.test(v)) return `קוד ${label} חייב להכיל 2 ספרות (00–99)`
  return null
}

export function hasErrors(errors: Record<string, string | null>): boolean {
  return Object.values(errors).some(Boolean)
}

// Maps backend validation issues (zod paths) onto the form's field errors.
export function applyIssues<T extends Record<string, string | null>>(
  errors: T,
  issues: { path: string; message: string }[],
  fieldFor: (path: string) => string = (path) => path,
): T {
  const next = { ...errors }
  for (const issue of issues) {
    const field = fieldFor(issue.path)
    if (field in next) next[field as keyof T] = issue.message as T[keyof T]
  }
  return next
}
