import { Box } from '@mui/material'
import GoSouthLogo from '../assets/go_south_logo.svg?react'

const LOGO_WIDTH = 67
const LOGO_HEIGHT = 34
// Distance from the top/side viewport edge, outside any safe-area inset.
const LOGO_INSET = 12

// Top offset that vertically centers an element of `height` on the fixed logo,
// so other screens can line their own corner controls up with the brand mark.
export const alignWithLogo = (height: number) =>
  `calc(env(safe-area-inset-top, 0px) + ${LOGO_INSET + (LOGO_HEIGHT - height) / 2}px)`

// Fixed brand mark shown in the top-left corner of every screen.
// Sits above page content (max zIndex in the pages is 2) but below MUI
// modals (1300) so dialogs still cover it. Click-through by design.
export default function AppLogo() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        top: alignWithLogo(LOGO_HEIGHT),
        left: `calc(env(safe-area-inset-left, 0px) + ${LOGO_INSET}px)`,
        zIndex: 1100,
        pointerEvents: 'none',
        lineHeight: 0,
        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))',
      }}
    >
      <GoSouthLogo width={LOGO_WIDTH} height={LOGO_HEIGHT} />
    </Box>
  )
}
