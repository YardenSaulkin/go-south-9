import { Avatar, Box, Menu, MenuItem, ListItemIcon, Paper, Typography } from '@mui/material'
import { useState } from 'react'
import { Camera, CalendarDays, MapPin, BarChart3, LogOut, Package, type LucideIcon } from 'lucide-react'
import { navigate } from '../../navigation'
import { clearCurrentUser, userDisplayName, type AuthenticatedUser } from '../../auth/session'
import FacilityScreen from '../components/FacilityScreen'
import { cardSx, facilityColors } from '../theme'

interface ModuleCard {
  label: string
  description: string
  Icon: LucideIcon
  path: string
}

const MODULES: ModuleCard[] = [
  {
    label: 'צלם וטפל',
    description: 'דווח על תקלה עם AI',
    Icon: Camera,
    path: '/facility/report',
  },
  {
    label: 'חדרים משותפים',
    description: 'הזמנה וניהול חדרים',
    Icon: CalendarDays,
    path: '/facility/rooms',
  },
  {
    label: 'ניווט במתחם',
    description: 'מצא את דרכך',
    Icon: MapPin,
    path: '/facility/navigate',
  },
  {
    label: 'תובנות מתחם',
    description: 'עומסים, תקלות והמלצות',
    Icon: BarChart3,
    path: '/facility/insights',
  },
]

function greeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'בוקר טוב'
  if (hour < 18) return 'צהריים טובים'
  return 'ערב טוב'
}

export default function FacilityHomePage({ user }: { user: AuthenticatedUser }) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const name = userDisplayName(user)

  return (
    <FacilityScreen activeTab="home">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mt: 0.5,
          mb: 2.5,
        }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{ fontSize: '1.75rem', fontWeight: 700, color: facilityColors.text }}
          >
            {greeting(new Date())}, {name.split(' ')[0]}
          </Typography>
          <Typography sx={{ color: facilityColors.textMuted, mt: 0.25 }}>
            איך נוכל לעזור לך היום?
          </Typography>
        </Box>
        <Avatar
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          aria-label="תפריט משתמש"
          sx={{
            width: 40,
            height: 40,
            cursor: 'pointer',
            bgcolor: 'rgba(139, 94, 60, 0.9)',
            border: '2px solid rgba(255,255,255,0.6)',
            fontWeight: 700,
            fontSize: '1rem',
          }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </Avatar>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { borderRadius: '14px', minWidth: 180 } } }}
      >
        <MenuItem
          sx={{ minHeight: 52, fontWeight: 600, color: facilityColors.text }}
          onClick={() => {
            setMenuAnchor(null)
            navigate('/menu')
          }}
        >
          <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
            <Package size={20} />
          </ListItemIcon>
          מעבר לניהול ההובלות
        </MenuItem>
        <MenuItem
          sx={{ minHeight: 52, fontWeight: 600, color: facilityColors.text }}
          onClick={() => {
            setMenuAnchor(null)
            clearCurrentUser()
            navigate('/home')
          }}
        >
          <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
            <LogOut size={20} />
          </ListItemIcon>
          התנתק
        </MenuItem>
      </Menu>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1.5,
        }}
      >
        {MODULES.map(({ label, description, Icon, path }) => (
          <Paper
            key={path}
            elevation={0}
            role="button"
            aria-label={label}
            onClick={() => navigate(path)}
            sx={{
              ...cardSx,
              p: 2,
              minHeight: 128,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 0.75,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.15s ease',
              '&:active': { transform: 'scale(0.97)' },
            }}
          >
            <Icon size={26} color={facilityColors.primary} strokeWidth={1.7} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: facilityColors.text }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: facilityColors.textMuted, lineHeight: 1.3 }}>
              {description}
            </Typography>
          </Paper>
        ))}
      </Box>
    </FacilityScreen>
  )
}
