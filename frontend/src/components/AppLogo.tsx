import { Box } from '@mui/material'
import GoSouthLogo from '../assets/go_south_logo.svg?react'

// Fixed brand mark shown in the top-left corner of every screen.
// Sits above page content (max zIndex in the pages is 2) but below MUI
// modals (1300) so dialogs still cover it. Click-through by design.
export default function AppLogo() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        zIndex: 1100,
        pointerEvents: 'none',
        lineHeight: 0,
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
      }}
    >
      <GoSouthLogo width={67} height={34} />
    </Box>
  )
}
