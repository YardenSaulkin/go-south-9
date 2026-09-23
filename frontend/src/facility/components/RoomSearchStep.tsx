import { useState } from 'react'
import { Box, Button, Collapse, InputAdornment, Paper, TextField, Typography } from '@mui/material'
import { Search, Users, CalendarDays, Clock, SlidersHorizontal } from 'lucide-react'
import { cardSx, facilityColors } from '../theme'

export interface RoomSearchForm {
  q: string
  capacityBand: string | null
  date: string
  startTime: string
  endTime: string
  features: string[]
}

export const CAPACITY_BANDS: { id: string; label: string; min: number; max?: number }[] = [
  { id: '2-4', label: '2-4', min: 2, max: 4 },
  { id: '5-8', label: '5-8', min: 5, max: 8 },
  { id: '9-12', label: '9-12', min: 9, max: 12 },
  { id: '12+', label: '12+', min: 12 },
]

export const FEATURE_OPTIONS: { id: string; label: string }[] = [
  { id: 'screen', label: 'מסך' },
  { id: 'video', label: 'ועידה' },
  { id: 'whiteboard', label: 'לוח מחיק' },
]

interface RoomSearchStepProps {
  form: RoomSearchForm
  onChange: (form: RoomSearchForm) => void
  onSearch: () => void
  searching: boolean
}

function Chip({
  label,
  selected,
  onClick,
  icon,
}: {
  label: string
  selected: boolean
  onClick: () => void
  icon?: React.ReactNode
}) {
  return (
    <Box
      role="button"
      aria-pressed={selected}
      onClick={onClick}
      sx={{
        flex: 1,
        minHeight: 52,
        px: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.25,
        borderRadius: '14px',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        border: `1px solid ${selected ? facilityColors.primary : facilityColors.cardBorder}`,
        bgcolor: selected ? 'rgba(139, 94, 60, 0.12)' : facilityColors.card,
        color: selected ? facilityColors.primary : facilityColors.textMuted,
        fontWeight: selected ? 700 : 500,
        fontSize: '0.85rem',
      }}
    >
      {icon}
      {label}
    </Box>
  )
}

// Screen 5: the search criteria, in the card-and-chip language of the design.
export default function RoomSearchStep({ form, onChange, onSearch, searching }: RoomSearchStepProps) {
  const [showFilters, setShowFilters] = useState(false)
  const update = (patch: Partial<RoomSearchForm>) => onChange({ ...form, ...patch })

  const toggleFeature = (id: string) =>
    update({
      features: form.features.includes(id)
        ? form.features.filter((feature) => feature !== id)
        : [...form.features, id],
    })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        value={form.q}
        onChange={(event) => update({ q: event.target.value })}
        placeholder="חיפוש חדר, קומה או ציוד…"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} color={facilityColors.textMuted} />
              </InputAdornment>
            ),
            sx: { bgcolor: facilityColors.card, borderRadius: '14px' },
          },
        }}
      />

      <Box sx={{ display: 'flex', gap: 1 }}>
        {CAPACITY_BANDS.map((band) => (
          <Chip
            key={band.id}
            label={band.label}
            selected={form.capacityBand === band.id}
            onClick={() => update({ capacityBand: form.capacityBand === band.id ? null : band.id })}
            icon={<Users size={16} />}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Paper elevation={0} sx={{ ...cardSx, flex: 1, p: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
            <CalendarDays size={16} color={facilityColors.primary} />
            <Typography sx={{ fontSize: '0.78rem', color: facilityColors.textMuted }}>
              תאריך
            </Typography>
          </Box>
          <TextField
            type="date"
            value={form.date}
            onChange={(event) => update({ date: event.target.value })}
            variant="standard"
            fullWidth
            slotProps={{ input: { disableUnderline: true, sx: { fontWeight: 600 } } }}
          />
        </Paper>

        <Paper elevation={0} sx={{ ...cardSx, flex: 1, p: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
            <Clock size={16} color={facilityColors.primary} />
            <Typography sx={{ fontSize: '0.78rem', color: facilityColors.textMuted }}>
              שעה
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TextField
              type="time"
              value={form.startTime}
              onChange={(event) => update({ startTime: event.target.value })}
              variant="standard"
              slotProps={{ input: { disableUnderline: true, sx: { fontWeight: 600 } } }}
            />
            <Typography sx={{ color: facilityColors.textMuted }}>–</Typography>
            <TextField
              type="time"
              value={form.endTime}
              onChange={(event) => update({ endTime: event.target.value })}
              variant="standard"
              slotProps={{ input: { disableUnderline: true, sx: { fontWeight: 600 } } }}
            />
          </Box>
        </Paper>
      </Box>

      <Paper
        elevation={0}
        role="button"
        onClick={() => setShowFilters((value) => !value)}
        sx={{
          ...cardSx,
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <Typography sx={{ fontWeight: 600, color: facilityColors.text }}>סינונים נוספים</Typography>
        <SlidersHorizontal size={18} color={facilityColors.primary} />
      </Paper>

      <Collapse in={showFilters}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {FEATURE_OPTIONS.map((feature) => (
            <Chip
              key={feature.id}
              label={feature.label}
              selected={form.features.includes(feature.id)}
              onClick={() => toggleFeature(feature.id)}
            />
          ))}
        </Box>
      </Collapse>

      <Button
        variant="contained"
        disableElevation
        onClick={onSearch}
        disabled={searching}
        sx={{ bgcolor: facilityColors.primary, '&:hover': { bgcolor: facilityColors.primaryDark } }}
      >
        {searching ? 'מחפש…' : 'חפש חדרים'}
      </Button>
    </Box>
  )
}
