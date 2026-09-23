import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { TrendingUp, TrendingDown, CalendarRange, Flame } from 'lucide-react'
import { navigate } from '../../navigation'
import FacilityScreen from '../components/FacilityScreen'
import { fetchInsights, type FacilityInsights } from '../api'
import { cardSx, facilityColors } from '../theme'

const WINDOWS = [
  { days: 7, label: 'שבוע אחרון' },
  { days: 30, label: 'חודש אחרון' },
  { days: 90, label: 'רבעון אחרון' },
]

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳']

function Delta({ value, inverted = false }: { value: number | null; inverted?: boolean }) {
  if (value === null || value === 0) {
    return (
      <Typography sx={{ fontSize: '0.72rem', color: facilityColors.textMuted }}>
        ללא שינוי
      </Typography>
    )
  }

  // For open calls and response time, going down is the good direction.
  const isGood = inverted ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : TrendingDown

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.3,
        color: isGood ? facilityColors.success : facilityColors.danger,
      }}
    >
      <Icon size={13} />
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 600 }}>
        {value > 0 ? '+' : ''}
        {value}%
      </Typography>
    </Box>
  )
}

function StatTile({
  value,
  label,
  delta,
  inverted,
}: {
  value: string
  label: string
  delta: number | null
  inverted?: boolean
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...cardSx,
        p: 1.5,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: '1.45rem', fontWeight: 700, color: facilityColors.text }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.72rem', color: facilityColors.textMuted, lineHeight: 1.25 }}>
        {label}
      </Typography>
      <Delta value={delta} inverted={inverted} />
    </Paper>
  )
}

// Screen 8: every figure here is computed by the backend from the compound's
// own reservations and maintenance calls.
export default function FacilityInsightsPage() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<FacilityInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchInsights(days)
      .then((insights) => {
        if (!cancelled) {
          setData(insights)
          setError(null)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'טעינת התובנות נכשלה')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [days])

  return (
    <FacilityScreen
      title="תובנות מתחם"
      subtitle="מבוסס על נתוני שימוש וקריאות שירות"
      onBack={() => navigate('/facility')}
      activeTab="more"
    >
      <TextField
        select
        size="small"
        value={days}
        onChange={(event) => setDays(Number(event.target.value))}
        sx={{ alignSelf: 'flex-start', mb: 1.5, minWidth: 150, bgcolor: facilityColors.card, borderRadius: '12px' }}
      >
        {WINDOWS.map((window) => (
          <MenuItem key={window.days} value={window.days}>
            {window.label}
          </MenuItem>
        ))}
      </TextField>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress sx={{ color: facilityColors.primary }} />
        </Box>
      ) : (
        data && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <StatTile
                value={`${data.occupancy.rate}%`}
                label="תפוסת חדרים"
                delta={data.occupancy.changePercent}
              />
              <StatTile
                value={String(data.reports.open)}
                label="קריאות פתוחות"
                delta={data.reports.changePercent}
                inverted
              />
              <StatTile
                value={data.responseTime.sampleSize ? `${data.responseTime.averageHours}` : '—'}
                label="זמן תגובה ממוצע (שעות)"
                delta={data.responseTime.changePercent}
                inverted
              />
            </Box>

            <Paper elevation={0} sx={{ ...cardSx, p: 1.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
                <CalendarRange size={18} color={facilityColors.primary} />
                <Typography sx={{ fontWeight: 700, color: facilityColors.text }}>
                  עומסים בחדרים
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35, pt: 2.5 }}>
                  {data.heatmap.days.map((day) => (
                    <Typography
                      key={day}
                      sx={{ fontSize: '0.68rem', color: facilityColors.textMuted, height: 18, lineHeight: '18px' }}
                    >
                      {DAY_LABELS[day] ?? ''}
                    </Typography>
                  ))}
                </Box>

                <Box sx={{ flex: 1, overflowX: 'auto' }}>
                  <Box sx={{ display: 'flex', gap: 0.35, mb: 0.5 }}>
                    {data.heatmap.hours.map((hour) => (
                      <Typography
                        key={hour}
                        sx={{
                          flex: 1,
                          minWidth: 22,
                          fontSize: '0.6rem',
                          color: facilityColors.textMuted,
                          textAlign: 'center',
                        }}
                      >
                        {hour % 2 === 0 ? String(hour).padStart(2, '0') : ''}
                      </Typography>
                    ))}
                  </Box>
                  {data.heatmap.cells.map((row, rowIndex) => (
                    <Box key={rowIndex} sx={{ display: 'flex', gap: 0.35, mb: 0.35 }}>
                      {row.map((intensity, cellIndex) => (
                        <Box
                          key={cellIndex}
                          title={`${intensity}%`}
                          sx={{
                            flex: 1,
                            minWidth: 22,
                            height: 18,
                            borderRadius: '4px',
                            // Same hue throughout; only the density changes.
                            bgcolor: `rgba(217, 138, 75, ${0.12 + (intensity / 100) * 0.85})`,
                          }}
                        />
                      ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ ...cardSx, p: 1.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
                <Flame size={18} color={facilityColors.primary} />
                <Typography sx={{ fontWeight: 700, color: facilityColors.text }}>
                  סוגי תקלות נפוצים
                </Typography>
              </Box>

              {data.categories.length === 0 ? (
                <Typography sx={{ fontSize: '0.85rem', color: facilityColors.textMuted }}>
                  לא נפתחו קריאות בתקופה זו
                </Typography>
              ) : (
                data.categories.map((category) => (
                  <Box key={category.category} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography sx={{ fontSize: '0.85rem', color: facilityColors.text }}>
                        {category.label}
                      </Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: facilityColors.text }}>
                        {category.percent}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(139,94,60,0.12)' }}>
                      <Box
                        sx={{
                          width: `${category.percent}%`,
                          height: '100%',
                          borderRadius: 4,
                          bgcolor: facilityColors.accent,
                        }}
                      />
                    </Box>
                  </Box>
                ))
              )}
            </Paper>

            <Paper elevation={0} sx={{ ...cardSx, p: 1.75 }}>
              <Typography sx={{ fontWeight: 700, color: facilityColors.text, mb: 1 }}>
                החדרים המבוקשים ביותר
              </Typography>
              {data.busiestRooms.map((room) => (
                <Box
                  key={room.roomId}
                  sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}
                >
                  <Typography sx={{ fontSize: '0.88rem', color: facilityColors.text }}>
                    {room.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.88rem', color: facilityColors.textMuted }}>
                    {room.bookedHours} שעות
                  </Typography>
                </Box>
              ))}
            </Paper>
          </Box>
        )
      )}
    </FacilityScreen>
  )
}
