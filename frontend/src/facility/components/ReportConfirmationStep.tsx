import { Box, Button, Paper, Typography } from '@mui/material'
import { Check, ClipboardList, Plus, Lightbulb } from 'lucide-react'
import type { FacilityReport } from '../api'
import { cardSx, facilityColors } from '../theme'

interface ReportConfirmationStepProps {
  report: FacilityReport
  onFollow: () => void
  onAnother: () => void
}

function formatDeadline(dueAt: string): string {
  const due = new Date(dueAt)
  const hoursLeft = Math.max(0, Math.round((due.getTime() - Date.now()) / 3_600_000))
  return `עד ${hoursLeft} שעות`
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography sx={{ color: facilityColors.textMuted, fontSize: '0.9rem' }}>{label}</Typography>
      <Typography sx={{ fontWeight: 600, color: facilityColors.text, fontSize: '0.9rem' }}>
        {value}
      </Typography>
    </Box>
  )
}

// Screen 4: everything shown here comes back from the backend — the call
// number, the team it was routed to, and the response time it committed to.
export default function ReportConfirmationStep({
  report,
  onFollow,
  onAnother,
}: ReportConfirmationStepProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
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

        <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, color: facilityColors.text, mb: 2 }}>
          הקריאה נשלחה בהצלחה!
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, textAlign: 'start' }}>
          <DetailLine label="מספר קריאה" value={`#${report.reportNumber}`} />
          <DetailLine label="גורם מטפל" value={report.assignedTeam} />
          <DetailLine label="זמן תגובה משוער" value={formatDeadline(report.dueAt)} />
          <DetailLine label="סטטוס" value={report.statusLabel} />
          {report.locationDescription && (
            <DetailLine label="מיקום" value={report.locationDescription} />
          )}
        </Box>
      </Paper>

      <Button
        variant="contained"
        disableElevation
        onClick={onFollow}
        startIcon={<ClipboardList size={18} />}
        sx={{ bgcolor: facilityColors.primary, '&:hover': { bgcolor: facilityColors.primaryDark } }}
      >
        מעקב אחרי קריאה
      </Button>

      <Button
        variant="outlined"
        onClick={onAnother}
        startIcon={<Plus size={18} />}
        sx={{
          color: facilityColors.primary,
          borderColor: facilityColors.cardBorder,
          bgcolor: facilityColors.card,
        }}
      >
        דיווח נוסף
      </Button>

      <Paper
        elevation={0}
        sx={{ ...cardSx, p: 1.75, display: 'flex', gap: 1.25, alignItems: 'flex-start' }}
      >
        <Lightbulb size={20} color={facilityColors.accent} />
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: facilityColors.text }}>
            טיפ מהמנגב
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: facilityColors.textMuted, lineHeight: 1.4 }}>
            ניתן לעקוב אחרי סטטוס הקריאה בכל רגע דרך "הקריאות שלי" בתפריט התחתון.
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
