import { useState } from 'react'
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material'
import {
  Home,
  Package,
  CalendarDays,
  MoreHorizontal,
  BarChart3,
  MapPin,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import { navigate } from '../../navigation'
import { facilityColors } from '../theme'

export type FacilityTab = 'home' | 'logistics' | 'rooms' | 'more'

export const FACILITY_NAV_HEIGHT = 64

const TABS: { id: FacilityTab; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'בית', Icon: Home },
  // Keeps the move itself one tap away — the two modes live side by side.
  { id: 'logistics', label: 'מעבר', Icon: Package },
  { id: 'rooms', label: 'חדרים', Icon: CalendarDays },
  { id: 'more', label: 'עוד', Icon: MoreHorizontal },
]

const MORE_ITEMS: { label: string; Icon: LucideIcon; path: string }[] = [
  { label: 'תובנות מתחם', Icon: BarChart3, path: '/facility/insights' },
  { label: 'ניווט במתחם', Icon: MapPin, path: '/facility/navigate' },
  { label: 'קריאות שירות', Icon: ClipboardList, path: '/facility/reports' },
]

export default function FacilityNavBar({ active }: { active?: FacilityTab }) {
  const [moreOpen, setMoreOpen] = useState(false)

  const handleTab = (id: FacilityTab) => {
    if (id === 'home') navigate('/facility')
    else if (id === 'logistics') navigate('/menu')
    else if (id === 'rooms') navigate('/facility/rooms')
    else setMoreOpen(true)
  }

  return (
    <>
      <Box
        component="nav"
        dir="rtl"
        sx={{
          position: 'fixed',
          insetInline: 0,
          bottom: 0,
          zIndex: 1200,
          height: `calc(${FACILITY_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          pb: 'env(safe-area-inset-bottom, 0px)',
          display: 'flex',
          alignItems: 'stretch',
          backgroundColor: '#FFF7EC',
          borderTop: `1px solid ${facilityColors.cardBorder}`,
          boxShadow: '0 -2px 14px rgba(93, 56, 24, 0.12)',
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <Box
              key={id}
              role="button"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleTab(id)}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.3,
                cursor: 'pointer',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                color: isActive ? facilityColors.primary : facilityColors.textMuted,
              }}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
              <Typography sx={{ fontSize: '0.7rem', fontWeight: isActive ? 700 : 500 }}>
                {label}
              </Typography>
            </Box>
          )
        })}
      </Box>

      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: '20px 20px 0 0', pb: 2 } } }}
      >
        <Box dir="rtl" sx={{ pt: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 4,
              borderRadius: 2,
              bgcolor: facilityColors.cardBorder,
              mx: 'auto',
              mb: 1,
            }}
          />
          <List>
            {MORE_ITEMS.map(({ label, Icon, path }) => (
              <ListItemButton
                key={path}
                sx={{ minHeight: 56 }}
                onClick={() => {
                  setMoreOpen(false)
                  navigate(path)
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: facilityColors.primary }}>
                  <Icon size={22} />
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  slotProps={{ primary: { sx: { fontWeight: 600, color: facilityColors.text } } }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
    </>
  )
}
