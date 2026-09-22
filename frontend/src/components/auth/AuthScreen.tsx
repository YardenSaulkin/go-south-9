import type { ReactNode } from 'react'
import { Box, ThemeProvider, createTheme } from '@mui/material'

const BROWN = '#6e4e37'
const BROWN_DARK = '#5a3515'

const authTheme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
  palette: {
    primary: { main: BROWN, dark: BROWN_DARK, contrastText: '#fff' },
  },
  components: {
    MuiTextField: {
      defaultProps: { fullWidth: true, variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)' },
        // 16px+ prevents iOS from zooming into the field on focus
        input: { fontSize: 17, padding: '15px 14px' },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: 16 } },
    },
  },
})

// Shared theme + desert background shell for the Home / Login / Sign Up screens.
export default function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={authTheme}>
      <Box
        dir="rtl"
        sx={{
          width: '100%',
          height: '100dvh',
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundImage:
            'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.25)), url(/desert-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundAttachment: 'fixed',
          backgroundColor: '#c9a46a',
          display: 'flex',
          justifyContent: 'center',
          px: 2,
          py: 4,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 440, my: 'auto' }}>{children}</Box>
      </Box>
    </ThemeProvider>
  )
}
