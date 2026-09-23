import type { ReactNode } from 'react'
import { Box, IconButton, ThemeProvider, Typography } from '@mui/material'
import { ChevronLeft } from 'lucide-react'
import GoSouthLogo from '../../assets/go_south_logo.svg?react'
import FacilityNavBar, { FACILITY_NAV_HEIGHT, type FacilityTab } from './FacilityNavBar'
import { facilityColors, facilityTheme } from '../theme'

interface FacilityScreenProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  activeTab?: FacilityTab
  children: ReactNode
}

// The frame every facility screen sits in: brand mark on the right, an
// optional back control on the left, and the mode's bottom navigation.
export default function FacilityScreen({
  title,
  subtitle,
  onBack,
  activeTab,
  children,
}: FacilityScreenProps) {
  return (
    <ThemeProvider theme={facilityTheme}>
      <Box
        dir="rtl"
        sx={{
          // The document itself does not scroll (see index.css), so the screen
          // owns its viewport and scrolls its content area instead.
          height: '100dvh',
          overflow: 'hidden',
          background: facilityColors.gradient,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexShrink: 0,
            px: 2,
            pt: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            pb: 1,
          }}
        >
          <GoSouthLogo width={60} height={30} aria-label="goS" />
          {onBack && (
            <IconButton
              onClick={onBack}
              aria-label="חזרה"
              sx={{ color: facilityColors.text, p: 1 }}
            >
              {/* RTL: back points left, the way the design shows it. */}
              <ChevronLeft size={26} />
            </IconButton>
          )}
        </Box>

        {(title || subtitle) && (
          <Box sx={{ px: 2, pb: 1.5, flexShrink: 0 }}>
            {title && (
              <Typography
                component="h1"
                sx={{
                  fontSize: '1.6rem',
                  fontWeight: 700,
                  color: facilityColors.text,
                  lineHeight: 1.25,
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography sx={{ fontSize: '0.95rem', color: facilityColors.textMuted, mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        )}

        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            display: 'flex',
            flexDirection: 'column',
            px: 2,
            pb: `calc(${FACILITY_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 16px)`,
          }}
        >
          {children}
        </Box>

        <FacilityNavBar active={activeTab} />
      </Box>
    </ThemeProvider>
  )
}
