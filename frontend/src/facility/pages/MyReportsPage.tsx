import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { MapPin, Clock, User } from 'lucide-react'
import { navigate } from '../../navigation'
import { useCurrentUser } from '../../auth/useCurrentUser'
import FacilityScreen from '../components/FacilityScreen'
import { fetchReports, type FacilityReport, type ReportStatus } from '../api'
import { cardSx, facilityColors } from '../theme'

type Scope = 'mine' | 'all'

const STATUS_COLOR: Record<ReportStatus, string> = {
  open: facilityColors.warning,
  assigned: facilityColors.accent,
  in_progress: facilityColors.primary,
  resolved: facilityColors.success,
}

const DATE_TIME = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function reporterName(report: FacilityReport): string {
  const reporter = report.reportedBy
  if (!reporter) return 'לא ידוע'
  const name = [reporter.firstName, reporter.lastName].filter(Boolean).join(' ').trim()
  return name || reporter.personalNumber || 'לא ידוע'
}

// Following a call. An admin can switch between their own calls and every call
// opened in the compound; for everyone else the page shows only their own.
export default function MyReportsPage() {
  const user = useCurrentUser()
  const isAdmin = user?.role === 'admin'

  const [scope, setScope] = useState<Scope>(isAdmin ? 'all' : 'mine')
  const [reports, setReports] = useState<FacilityReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchReports(scope)
      .then((rows) => {
        if (!cancelled) {
          setReports(rows)
          setError(null)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'טעינת הקריאות נכשלה')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [scope])

  const showingAll = isAdmin && scope === 'all'

  return (
    <FacilityScreen
      title={showingAll ? 'כל הקריאות' : 'הקריאות שלי'}
      subtitle={
        showingAll
          ? 'כל קריאות השירות שנפתחו במתחם'
          : 'מעקב אחרי קריאות השירות שפתחת'
      }
      onBack={() => navigate('/facility')}
      activeTab="more"
    >
      {isAdmin && (
        <ToggleButtonGroup
          value={scope}
          exclusive
          onChange={(_, value: Scope | null) => value && setScope(value)}
          sx={{
            mb: 1.5,
            bgcolor: facilityColors.card,
            borderRadius: '999px',
            p: '3px',
            gap: '3px',
            '& .MuiToggleButtonGroup-grouped': {
              border: 'none',
              borderRadius: '999px !important',
              px: 2,
              py: 0.6,
              minHeight: 40,
              textTransform: 'none',
              fontWeight: 600,
              color: facilityColors.textMuted,
              '&.Mui-selected': {
                bgcolor: facilityColors.primary,
                color: '#FFF',
                '&:hover': { bgcolor: facilityColors.primaryDark },
              },
            },
          }}
        >
          <ToggleButton value="all">כל הקריאות</ToggleButton>
          <ToggleButton value="mine">הקריאות שלי</ToggleButton>
        </ToggleButtonGroup>
      )}

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress sx={{ color: facilityColors.primary }} />
        </Box>
      ) : reports.length === 0 ? (
        <Typography sx={{ color: facilityColors.textMuted, textAlign: 'center', mt: 6 }}>
          {showingAll ? 'עדיין לא נפתחו קריאות במתחם' : 'עדיין לא פתחת קריאות שירות'}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 2 }}>
          {reports.map((report) => (
            <Paper key={report.id} elevation={0} sx={{ ...cardSx, p: 1.75 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Chip
                  size="small"
                  label={report.statusLabel}
                  sx={{
                    fontWeight: 600,
                    color: '#FFF',
                    bgcolor: STATUS_COLOR[report.status],
                  }}
                />
                <Typography sx={{ fontSize: '0.8rem', color: facilityColors.textMuted }}>
                  #{report.reportNumber}
                </Typography>
              </Box>

              <Typography sx={{ fontWeight: 700, color: facilityColors.text }}>
                {report.objectLabel} · {report.issueDescription}
              </Typography>

              {report.locationDescription && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.4, color: facilityColors.textMuted }}>
                  <MapPin size={14} />
                  <Typography sx={{ fontSize: '0.82rem' }}>{report.locationDescription}</Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3, color: facilityColors.textMuted }}>
                <Clock size={14} />
                <Typography sx={{ fontSize: '0.82rem' }}>
                  נפתחה {DATE_TIME.format(new Date(report.createdAt))} · {report.assignedTeam}
                </Typography>
              </Box>

              {/* Who opened the call only matters when looking beyond your own. */}
              {showingAll && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3, color: facilityColors.textMuted }}>
                  <User size={14} />
                  <Typography sx={{ fontSize: '0.82rem' }}>{reporterName(report)}</Typography>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}
    </FacilityScreen>
  )
}
