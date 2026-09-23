import { Box, Button, Chip, Paper, Typography } from '@mui/material'
import { Users, MapPin, Monitor, Video, PenSquare } from 'lucide-react'
import type { Room } from '../api'
import { cardSx, facilityColors } from '../theme'

const FEATURE_ICONS: Record<string, { Icon: typeof Monitor; label: string }> = {
  screen: { Icon: Monitor, label: 'מסך' },
  video: { Icon: Video, label: 'ועידה' },
  whiteboard: { Icon: PenSquare, label: 'לוח מחיק' },
}

interface RoomResultsStepProps {
  rooms: Room[]
  windowLabel: string
  onSelect: (room: Room) => void
}

// Screen 6: the matching rooms. Rooms that are taken in the requested window
// stay on the list, marked, so the user sees the whole picture.
export default function RoomResultsStep({ rooms, windowLabel, onSelect }: RoomResultsStepProps) {
  if (rooms.length === 0) {
    return (
      <Typography sx={{ color: facilityColors.textMuted, textAlign: 'center', mt: 6 }}>
        לא נמצאו חדרים שמתאימים לחיפוש
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.85rem', color: facilityColors.textMuted }}>
          {windowLabel}
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: facilityColors.text }}>
          {rooms.length} תוצאות נמצאו
        </Typography>
      </Box>

      {rooms.map((room) => (
        <Paper key={room.id} elevation={0} sx={{ ...cardSx, p: 1.5, display: 'flex', gap: 1.5 }}>
          <Box
            sx={{
              width: 92,
              height: 92,
              flexShrink: 0,
              borderRadius: '14px',
              bgcolor: 'rgba(139, 94, 60, 0.12)',
              backgroundImage: room.imageUrl ? `url(${room.imageUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: facilityColors.primary,
            }}
          >
            {!room.imageUrl && <MapPin size={26} />}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 700, color: facilityColors.text }}>
                {room.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: facilityColors.textMuted }}>
                <Users size={15} />
                <Typography sx={{ fontSize: '0.8rem' }}>{room.capacity}</Typography>
              </Box>
            </Box>

            <Typography sx={{ fontSize: '0.8rem', color: facilityColors.textMuted }}>
              קומה {room.floor}, בניין {room.building}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', color: facilityColors.textMuted }}>
              {room.features.map((feature) => {
                const meta = FEATURE_ICONS[feature]
                if (!meta) return null
                return (
                  <Box key={feature} sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                    <meta.Icon size={14} />
                    <Typography sx={{ fontSize: '0.72rem' }}>{meta.label}</Typography>
                  </Box>
                )
              })}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4 }}>
              {room.isAvailable ? (
                <Button
                  size="small"
                  variant="contained"
                  disableElevation
                  onClick={() => onSelect(room)}
                  sx={{
                    minHeight: 36,
                    px: 2.5,
                    bgcolor: facilityColors.primary,
                    '&:hover': { bgcolor: facilityColors.primaryDark },
                  }}
                >
                  הזמן
                </Button>
              ) : (
                <>
                  <Chip label="תפוס בשעה זו" size="small" sx={{ fontWeight: 600 }} />
                  <Button
                    size="small"
                    onClick={() => onSelect(room)}
                    sx={{ minHeight: 36, color: facilityColors.primary }}
                  >
                    בחר שעה אחרת
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Paper>
      ))}
    </Box>
  )
}
