import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Typography } from '@mui/material'
import {
  ChevronLeft,
  ChevronRight,
  Users,
  MapPin,
  Monitor,
  Video,
  PenSquare,
  Check,
} from 'lucide-react'
import { fetchRoomAvailability, reserveRoom, type Reservation, type Room } from '../api'
import { cardSx, facilityColors } from '../theme'

const FEATURE_ICONS: Record<string, { Icon: typeof Monitor; label: string }> = {
  screen: { Icon: Monitor, label: 'מסך' },
  video: { Icon: Video, label: 'ועידה' },
  whiteboard: { Icon: PenSquare, label: 'לוח מחיק' },
}

// The compound's bookable hours; a slot is one hour long, as in the design.
const FIRST_HOUR = 8
const LAST_HOUR = 17

const HEBREW_DATE = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function atHour(day: Date, hour: number): Date {
  const date = new Date(day)
  date.setHours(hour, 0, 0, 0)
  return date
}

interface RoomBookingStepProps {
  room: Room
  initialDate: Date
  onBooked: (details: { room: Room; startAt: Date; endAt: Date }) => void
}

// Screen 7: pick a day and an hour that is actually free, then book it. The
// slots come from the room's reservations, and the reservation itself is
// created by the backend.
export default function RoomBookingStep({ room, initialDate, onBooked }: RoomBookingStepProps) {
  const [day, setDay] = useState(() => {
    const start = new Date(initialDate)
    start.setHours(0, 0, 0, 0)
    return start
  })
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSelectedHour(null)

    const from = atHour(day, 0)
    const to = new Date(from.getTime() + 86_400_000)

    fetchRoomAvailability(room.id, from.toISOString(), to.toISOString())
      .then((availability) => {
        if (!cancelled) setReservations(availability.reservations)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'טעינת הזמינות נכשלה')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [room.id, day])

  const takenHours = useMemo(() => {
    const taken = new Set<number>()
    for (const reservation of reservations) {
      const start = new Date(reservation.startAt)
      const end = new Date(reservation.endAt)
      for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
        const slotStart = atHour(day, hour)
        const slotEnd = atHour(day, hour + 1)
        if (slotStart < end && slotEnd > start) taken.add(hour)
      }
    }
    return taken
  }, [reservations, day])

  const hours = useMemo(
    () => Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => FIRST_HOUR + index),
    [],
  )

  const shiftDay = (deltaDays: number) => {
    const next = new Date(day)
    next.setDate(next.getDate() + deltaDays)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (next < today) return
    setDay(next)
  }

  const handleBook = async () => {
    if (selectedHour === null) return
    setBooking(true)
    setError(null)

    const startAt = atHour(day, selectedHour)
    const endAt = atHour(day, selectedHour + 1)

    try {
      await reserveRoom(room.id, {
        idempotencyKey: crypto.randomUUID(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      })
      onBooked({ room, startAt, endAt })
    } catch (caught) {
      // A slot can be taken between loading the strip and tapping it; the
      // backend rejects the overlap and the strip is reloaded.
      setError(caught instanceof Error ? caught.message : 'ההזמנה נכשלה')
      setSelectedHour(null)
      const from = atHour(day, 0)
      const to = new Date(from.getTime() + 86_400_000)
      fetchRoomAvailability(room.id, from.toISOString(), to.toISOString())
        .then((availability) => setReservations(availability.reservations))
        .catch(() => undefined)
    } finally {
      setBooking(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
      <Box
        sx={{
          height: 170,
          borderRadius: '18px',
          bgcolor: 'rgba(139, 94, 60, 0.14)',
          backgroundImage: room.imageUrl ? `url(${room.imageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: facilityColors.primary,
        }}
      >
        {!room.imageUrl && <MapPin size={34} />}
      </Box>

      <Paper elevation={0} sx={{ ...cardSx, p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.2rem', color: facilityColors.text }}>
            {room.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: facilityColors.textMuted }}>
            <Users size={16} />
            <Typography sx={{ fontSize: '0.85rem' }}>{room.capacity}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: facilityColors.textMuted, mt: 0.25 }}>
          <MapPin size={15} />
          <Typography sx={{ fontSize: '0.85rem' }}>
            קומה {room.floor}, בניין {room.building}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 1.25, color: facilityColors.textMuted }}>
          {room.features.map((feature) => {
            const meta = FEATURE_ICONS[feature]
            if (!meta) return null
            return (
              <Box key={feature} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                <meta.Icon size={18} />
                <Typography sx={{ fontSize: '0.7rem' }}>{meta.label}</Typography>
              </Box>
            )
          })}
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...cardSx, p: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* RTL: the chevron pointing right moves a day back. */}
          <IconButton aria-label="יום הבא" onClick={() => shiftDay(1)} sx={{ color: facilityColors.primary }}>
            <ChevronLeft size={22} />
          </IconButton>
          <Typography sx={{ fontWeight: 700, color: facilityColors.text }}>
            {HEBREW_DATE.format(day)}
          </Typography>
          <IconButton aria-label="יום קודם" onClick={() => shiftDay(-1)} sx={{ color: facilityColors.primary }}>
            <ChevronRight size={22} />
          </IconButton>
        </Box>
      </Paper>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress sx={{ color: facilityColors.primary }} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
          {hours.map((hour) => {
            const taken = takenHours.has(hour)
            const past = atHour(day, hour) <= new Date()
            const disabled = taken || past
            const selected = selectedHour === hour
            return (
              <Box
                key={hour}
                role="button"
                aria-disabled={disabled}
                aria-pressed={selected}
                onClick={() => !disabled && setSelectedHour(hour)}
                sx={{
                  flex: '0 0 auto',
                  minWidth: 64,
                  minHeight: 44,
                  px: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  border: `1px solid ${selected ? facilityColors.primary : facilityColors.cardBorder}`,
                  bgcolor: selected ? facilityColors.primary : facilityColors.card,
                  color: selected
                    ? '#FFF'
                    : disabled
                      ? 'rgba(138, 106, 79, 0.45)'
                      : facilityColors.text,
                  textDecoration: taken ? 'line-through' : 'none',
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </Box>
            )
          })}
        </Box>
      )}

      <Button
        variant="contained"
        disableElevation
        onClick={handleBook}
        disabled={selectedHour === null || booking}
        startIcon={booking ? <CircularProgress size={18} color="inherit" /> : <Check size={18} />}
        sx={{ bgcolor: facilityColors.primary, '&:hover': { bgcolor: facilityColors.primaryDark } }}
      >
        המשך
      </Button>
    </Box>
  )
}
