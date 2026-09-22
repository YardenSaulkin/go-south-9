import { useState, type ChangeEvent, type FormEvent } from 'react'
import { TextField } from '@mui/material'
import AuthLayout from '../components/auth/AuthLayout'
import { navigate } from '../navigation'
import { hasErrors, validateEmail, validatePersonalNumber } from '../components/auth/validation'

export interface LoginData {
  personalNumber: string
  email: string
}

type Field = keyof LoginData
type Errors = Record<Field, string | null>

interface LoginPageProps {
  // Connect to the API later; throw an Error to show its message on the form.
  onSubmit?: (data: LoginData) => Promise<void> | void
}

const validators: Record<Field, (v: string) => string | null> = {
  personalNumber: validatePersonalNumber,
  email: validateEmail,
}

export default function LoginPage({ onSubmit }: LoginPageProps) {
  const [values, setValues] = useState<LoginData>({ personalNumber: '', email: '' })
  const [errors, setErrors] = useState<Errors>({ personalNumber: null, email: null })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleChange = (field: Field) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = field === 'personalNumber' ? e.target.value.replace(/\D/g, '') : e.target.value
    setValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validators[field](value) }))
  }

  const handleBlur = (field: Field) => () => {
    setErrors((prev) => ({ ...prev, [field]: validators[field](values[field]) }))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)

    const nextErrors: Errors = {
      personalNumber: validators.personalNumber(values.personalNumber),
      email: validators.email(values.email),
    }
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return

    const data: LoginData = {
      personalNumber: values.personalNumber.trim(),
      email: values.email.trim(),
    }

    setSubmitting(true)
    try {
      if (onSubmit) await onSubmit(data)
      else console.log('login ->', data)
      navigate('/')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'ההתחברות נכשלה, נסה שוב')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="התחברות"
      subtitle="הזן את פרטיך כדי להתחבר"
      submitLabel="התחבר"
      submitting={submitting}
      submitError={submitError}
      onSubmit={handleSubmit}
      footerText="אין לך חשבון?"
      footerLinkLabel="להרשמה"
      footerLinkTo="/signup"
    >
      <TextField
        label="מספר אישי"
        name="personalNumber"
        value={values.personalNumber}
        onChange={handleChange('personalNumber')}
        onBlur={handleBlur('personalNumber')}
        error={Boolean(errors.personalNumber)}
        helperText={errors.personalNumber}
        required
        autoComplete="username"
        slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 7 } }}
      />
      <TextField
        label="אימייל"
        name="email"
        type="email"
        value={values.email}
        onChange={handleChange('email')}
        onBlur={handleBlur('email')}
        error={Boolean(errors.email)}
        helperText={errors.email}
        required
        autoComplete="email"
        slotProps={{ htmlInput: { inputMode: 'email', dir: 'ltr', autoCapitalize: 'none' } }}
      />
    </AuthLayout>
  )
}
