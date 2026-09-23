import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, CircularProgress, InputAdornment, Paper, TextField, Typography } from '@mui/material'
import { Search, MapPin, Users, Building2 } from 'lucide-react'
import { navigate } from '../../navigation'
import FacilityScreen from '../components/FacilityScreen'
import { searchRooms, type Room } from '../api'
import { cardSx, facilityColors } from '../theme'

// Finding your way around the compound: the same room directory the booking
// flow searches, grouped by building and floor.
export default function CompoundNavigationPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    searchRooms({})
      .then((results) => {
        if (!cancelled) setRooms(results)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'טעינת המתחם נכשלה')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const grouped = useMemo(() => {
    const term = query.trim()
    const matching = term
      ? rooms.filter(
          (room) =>
            room.name.includes(term) ||
            room.building.includes(term) ||
            room.floor.includes(term),
        )
      : rooms

    const byBuilding = new Map<string, Room[]>()
    for (const room of matching) {
      const list = byBuilding.get(room.building) ?? []
      list.push(room)
      byBuilding.set(room.building, list)
    }

    return Array.from(byBuilding.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [rooms, query])

  return (
    <FacilityScreen
      title="ניווט במתחם"
      subtitle="מצא את דרכך בין הבניינים והחדרים"
      onBack={() => navigate('/facility')}
      activeTab="more"
    >
      <TextField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="חפש חדר או בניין…"
        fullWidth
        sx={{ mb: 1.5 }}
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

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress sx={{ color: facilityColors.primary }} />
        </Box>
      ) : grouped.length === 0 ? (
        <Typography sx={{ color: facilityColors.textMuted, textAlign: 'center', mt: 6 }}>
          לא נמצאו חדרים תואמים
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
          {grouped.map(([building, buildingRooms]) => (
            <Paper key={building} elevation={0} sx={{ ...cardSx, p: 1.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <Building2 size={18} color={facilityColors.primary} />
                <Typography sx={{ fontWeight: 700, color: facilityColors.text }}>
                  בניין {building}
                </Typography>
              </Box>

              {buildingRooms
                .slice()
                .sort((a, b) => a.floor.localeCompare(b.floor))
                .map((room) => (
                  <Box
                    key={room.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.6,
                      borderTop: `1px solid ${facilityColors.cardBorder}`,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600, color: facilityColors.text }}>
                        {room.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: facilityColors.textMuted }}>
                        <MapPin size={13} />
                        <Typography sx={{ fontSize: '0.78rem' }}>קומה {room.floor}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: facilityColors.textMuted }}>
                      <Users size={14} />
                      <Typography sx={{ fontSize: '0.8rem' }}>{room.capacity}</Typography>
                    </Box>
                  </Box>
                ))}
            </Paper>
          ))}
        </Box>
      )}
    </FacilityScreen>
  )
}
