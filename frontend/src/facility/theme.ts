import { createTheme } from '@mui/material'

// Facility mode keeps the desert palette of the logistics screens, but leans
// on the lighter sand tones so the two modes read as one product without
// looking like the same screen.
export const facilityColors = {
  gradient: 'linear-gradient(180deg, #F7D6AC 0%, #F0BB86 48%, #E5A566 100%)',
  surface: '#FDF6EC',
  card: 'rgba(255, 250, 243, 0.94)',
  cardBorder: 'rgba(139, 94, 60, 0.16)',
  primary: '#8B5E3C',
  primaryDark: '#6E472C',
  accent: '#D98A4B',
  text: '#3B2412',
  textMuted: '#8A6A4F',
  success: '#3F8A63',
  warning: '#D98A4B',
  danger: '#BE5B3A',
} as const

export const facilityTheme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
  palette: {
    primary: { main: facilityColors.primary },
    text: { primary: facilityColors.text, secondary: facilityColors.textMuted },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: 14,
          // Every tap target on these screens is thumb sized.
          minHeight: 48,
        },
      },
    },
  },
})

export const cardSx = {
  backgroundColor: facilityColors.card,
  border: `1px solid ${facilityColors.cardBorder}`,
  borderRadius: '18px',
  boxShadow: '0 4px 16px rgba(93, 56, 24, 0.10)',
} as const
