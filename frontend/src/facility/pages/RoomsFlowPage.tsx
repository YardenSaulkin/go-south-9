import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material'
import { Check, CalendarDays } from 'lucide-react'
import { navigate } from '../../navigation'
import FacilityScreen from '../components/FacilityScreen'
import RoomSearchStep, {
  CAPACITY_BANDS,
  type RoomSearchForm,
} from '../components/RoomSearchStep'
import RoomResultsStep from '../components/RoomResultsStep'
import RoomBookingStep from '../components/RoomBookingStep'
import { searchRooms, type Room } from '../api'
import { cardSx, facilityColors } from '../theme'

type Step = 'search' | 'results' | 'booking' | 'done'

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

// Local wall-clock values from the form become absolute instants here, so the
// backend only ever deals in ISO timestamps.
function toInstant(date: string, time: string): Date | null {
  if (!date || !time) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if ([year, month, day, hour, minute].some(Number.isNaN)) return null
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

const TIME = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' })
const DATE = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' })

// The "חדרים משותפים" flow: search → results → booking → confirmation.
export default function RoomsFlowPage() {
  const [step, setStep] = useState<Step>('search')
  const [form, setForm] = useState<RoomSearchForm>({
    q: '',
    capacityBand: null,
    date: todayIso(),
    startTime: '10:00',
    endTime: '11:00',
    features: [],
  })
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [booked, setBooked] = useState<{ room: Room; startAt: Date; endAt: Date } | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startAt = toInstant(form.date, form.startTime)
  const endAt = toInstant(form.date, form.endTime)

  const handleSearch = async () => {
    setSearching(true)
    setError(null)

    const band = CAPACITY_BANDS.find((option) => option.id === form.capacityBand)

    try {
      const results = await searchRooms({
        q: form.q.trim() || undefined,
        minCapacity: band?.min,
        maxCapacity: band?.max,
        features: form.features.length ? form.features : undefined,
        startAt: startAt && endAt && endAt > startAt ? startAt.toISOString() : undefined,
        endAt: startAt && endAt && endAt > startAt ? endAt.toISOString() : undefined,
      })
      setRooms(results)
      setStep('results')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'החיפוש נכשל')
    } finally {
      setSearching(false)
    }
  }

  const windowLabel =
    startAt && endAt
      ? `${DATE.format(startAt)} · ${TIME.format(startAt)}–${TIME.format(endAt)}`
      : ''

  if (step === 'search') {
    return (
      <FacilityScreen
        title="חדרים משותפים"
        subtitle="מצא את החדר המתאים לך"
        onBack={() => navigate('/facility')}
        activeTab="rooms"
      >
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <RoomSearchStep form={form} onChange={setForm} onSearch={handleSearch} searching={searching} />
      </FacilityScreen>
    )
  }

  if (step === 'results') {
    return (
      <FacilityScreen
        title="תוצאות חיפוש חדרים"
        onBack={() => setStep('search')}
        activeTab="rooms"
      >
        {searching ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: facilityColors.primary }} />
          </Box>
        ) : (
          <RoomResultsStep
            rooms={rooms}
            windowLabel={windowLabel}
            onSelect={(room) => {
              setSelectedRoom(room)
              setStep('booking')
            }}
          />
        )}
      </FacilityScreen>
    )
  }

  if (step === 'booking' && selectedRoom) {
    return (
      <FacilityScreen title="הזמנת חדר" onBack={() => setStep('results')} activeTab="rooms">
        <RoomBookingStep
          room={selectedRoom}
          initialDate={startAt ?? new Date()}
          onBooked={(details) => {
            setBooked(details)
            setStep('done')
          }}
        />
      </FacilityScreen>
    )
  }

  return (
    <FacilityScreen title="ההזמנה אושרה" onBack={() => navigate('/facility')} activeTab="rooms">
      {booked && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Paper elevation={0} sx={{ ...cardSx, p: 3, textAlign: 'center' }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: facilityColors.accent,
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1.5,
              }}
            >
              <Check size={38} strokeWidth={3} />
            </Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: facilityColors.text }}>
              {booked.room.name} הוזמן עבורך
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                mt: 1,
                color: facilityColors.textMuted,
              }}
            >
              <CalendarDays size={17} />
              <Typography>
                {DATE.format(booked.startAt)} · {TIME.format(booked.startAt)}–
                {TIME.format(booked.endAt)}
              </Typography>
            </Box>
            <Typography sx={{ color: facilityColors.textMuted, mt: 0.5, fontSize: '0.85rem' }}>
              קומה {booked.room.floor}, בניין {booked.room.building}
            </Typography>
          </Paper>

          <Button
            variant="contained"
            disableElevation
            onClick={() => {
              setStep('search')
              setBooked(null)
            }}
            sx={{ bgcolor: facilityColors.primary, '&:hover': { bgcolor: facilityColors.primaryDark } }}
          >
            הזמנת חדר נוסף
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/facility')}
            sx={{
              color: facilityColors.primary,
              borderColor: facilityColors.cardBorder,
              bgcolor: facilityColors.card,
            }}
          >
            חזרה למסך הבית
          </Button>
        </Box>
      )}
    </FacilityScreen>
  )
}
