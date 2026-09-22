import { useState, type ChangeEvent, type FormEvent } from 'react'
import { TextField, type TextFieldProps } from '@mui/material'
import AuthLayout from '../components/auth/AuthLayout'
import { navigate } from '../navigation'
import { signup, type SignupPayload } from '../api/auth'
import { ApiError } from '../api/client'
import {
  applyIssues,
  hasErrors,
  validateEmail,
  validateOrgCode,
  validatePersonalNumber,
  validateRequired,
} from '../components/auth/validation'

export interface SignUpData {
  firstName: string
  lastName: string
  personalNumber: string
  email: string
  unit: string
  branch: string
  section: string
  team: string
}

type Field = keyof SignUpData
type Errors = Record<Field, string | null>

interface SignUpPageProps {
  // Connect to the API later; throw an Error to show its message on the form.
  onSubmit?: (data: SignUpData) => Promise<void> | void
}

interface FieldConfig {
  name: Field
  label: string
  validate: (v: string) => string | null
  inputProps?: TextFieldProps
}

const FIELDS: FieldConfig[] = [
  {
    name: 'firstName',
    label: 'שם פרטי',
    validate: (v) => validateRequired(v, 'שם פרטי'),
    inputProps: { autoComplete: 'given-name' },
  },
  {
    name: 'lastName',
    label: 'שם משפחה',
    validate: (v) => validateRequired(v, 'שם משפחה'),
    inputProps: { autoComplete: 'family-name' },
  },
  {
    name: 'personalNumber',
    label: 'מספר אישי',
    validate: validatePersonalNumber,
    inputProps: {
      autoComplete: 'username',
      slotProps: { htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 7 } },
    },
  },
  {
    name: 'email',
    label: 'אימייל',
    validate: validateEmail,
    inputProps: {
      type: 'email',
      autoComplete: 'email',
      slotProps: { htmlInput: { inputMode: 'email', dir: 'ltr', autoCapitalize: 'none' } },
    },
  },
  {
    name: 'unit',
    label: 'קוד יחידה',
    validate: (v) => validateOrgCode(v, 'יחידה'),
    inputProps: { slotProps: { htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 } } },
  },
  {
    name: 'branch',
    label: 'קוד ענף',
    validate: (v) => validateOrgCode(v, 'ענף'),
    inputProps: { slotProps: { htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 } } },
  },
  {
    name: 'section',
    label: 'קוד מדור',
    validate: (v) => validateOrgCode(v, 'מדור'),
    inputProps: { slotProps: { htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 } } },
  },
  {
    name: 'team',
    label: 'קוד צוות',
    validate: (v) => validateOrgCode(v, 'צוות'),
    inputProps: { slotProps: { htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 } } },
  },
]

const EMPTY: SignUpData = {
  firstName: '',
  lastName: '',
  personalNumber: '',
  email: '',
  unit: '',
  branch: '',
  section: '',
  team: '',
}

const NO_ERRORS: Errors = {
  firstName: null,
  lastName: null,
  personalNumber: null,
  email: null,
  unit: null,
  branch: null,
  section: null,
  team: null,
}

// The form labels ענף / מדור map onto the backend's anaf / mador fields.
const FIELD_BY_API_NAME: Record<string, Field> = { anaf: 'branch', mador: 'section' }

function toSignupPayload(data: SignUpData): SignupPayload {
  const { branch, section, ...rest } = data
  return { ...rest, anaf: branch, mador: section }
}

export default function SignUpPage({ onSubmit }: SignUpPageProps) {
  const [values, setValues] = useState<SignUpData>(EMPTY)
  const [errors, setErrors] = useState<Errors>(NO_ERRORS)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const NUMERIC_FIELDS: Field[] = ['personalNumber', 'unit', 'branch', 'section', 'team']

  const handleChange = (field: FieldConfig) => (e: ChangeEvent<HTMLInputElement>) => {
    const value =
      NUMERIC_FIELDS.includes(field.name) ? e.target.value.replace(/\D/g, '') : e.target.value
    setValues((prev) => ({ ...prev, [field.name]: value }))
    if (errors[field.name]) setErrors((prev) => ({ ...prev, [field.name]: field.validate(value) }))
  }

  const handleBlur = (field: FieldConfig) => () => {
    setErrors((prev) => ({ ...prev, [field.name]: field.validate(values[field.name]) }))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setSubmitError(null)

    const nextErrors = { ...NO_ERRORS }
    for (const f of FIELDS) nextErrors[f.name] = f.validate(values[f.name])
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return

    const data = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v.trim()]),
    ) as unknown as SignUpData

    setSubmitting(true)
    try {
      if (onSubmit) await onSubmit(data)
      else await signup(toSignupPayload(data))
      navigate('/menu')
    } catch (err) {
      if (err instanceof ApiError && err.issues.length > 0) {
        setErrors((prev) => applyIssues(prev, err.issues, (path) => FIELD_BY_API_NAME[path] ?? path))
      }
      setSubmitError(err instanceof Error ? err.message : 'ההרשמה נכשלה, נסה שוב')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="הרשמה"
      subtitle="כל השדות הם שדות חובה"
      submitLabel="הירשם"
      submitting={submitting}
      submitError={submitError}
      onSubmit={handleSubmit}
      footerText="כבר יש לך חשבון?"
      footerLinkLabel="להתחברות"
      footerLinkTo="/login"
    >
      {FIELDS.map((field) => (
        <TextField
          key={field.name}
          {...field.inputProps}
          label={field.label}
          name={field.name}
          value={values[field.name]}
          onChange={handleChange(field)}
          onBlur={handleBlur(field)}
          error={Boolean(errors[field.name])}
          helperText={errors[field.name]}
          required
        />
      ))}
    </AuthLayout>
  )
}
