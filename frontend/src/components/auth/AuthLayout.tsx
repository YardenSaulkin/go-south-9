import type { FormEvent, ReactNode } from 'react'
import { Alert, Button, Link, Paper, Typography } from '@mui/material'
import { navigate } from '../../navigation'
import AuthScreen from './AuthScreen'

const BROWN_DARK = '#5a3515'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  submitLabel: string
  submitting: boolean
  submitError?: string | null
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  footerText: string
  footerLinkLabel: string
  footerLinkTo: string
  children: ReactNode
}

export default function AuthLayout({
  title,
  subtitle,
  submitLabel,
  submitting,
  submitError,
  onSubmit,
  footerText,
  footerLinkLabel,
  footerLinkTo,
  children,
}: AuthLayoutProps) {
  return (
    <AuthScreen>
      <Typography
        component="h1"
        sx={{
          color: 'white',
          fontWeight: 700,
          fontSize: 30,
          textAlign: 'center',
          textShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 16,
            textAlign: 'center',
            mt: 0.5,
            textShadow: '0 1px 6px rgba(0,0,0,0.35)',
          }}
        >
          {subtitle}
        </Typography>
      )}

      <Paper
        component="form"
        noValidate
        onSubmit={onSubmit}
        elevation={0}
        sx={{
          mt: 3,
          p: 2.5,
          borderRadius: '20px',
          backgroundColor: 'rgba(245, 230, 200, 0.82)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {submitError && (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {submitError}
          </Alert>
        )}

        {children}

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={submitting}
          disableElevation
          sx={{
            minHeight: 54,
            mt: 1,
            borderRadius: '14px',
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {submitting ? 'שולח...' : submitLabel}
        </Button>

        <Typography sx={{ textAlign: 'center', fontSize: 16, color: '#2d1b0a' }}>
          {footerText}{' '}
          <Link
            href={footerLinkTo}
            onClick={(e) => {
              e.preventDefault()
              navigate(footerLinkTo)
            }}
            sx={{ fontWeight: 700, color: BROWN_DARK, display: 'inline-block', py: 1 }}
          >
            {footerLinkLabel}
          </Link>
        </Typography>
      </Paper>
    </AuthScreen>
  )
}
