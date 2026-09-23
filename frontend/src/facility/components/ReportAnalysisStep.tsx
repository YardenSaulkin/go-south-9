import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { Armchair, MapPin, AlertTriangle, Pencil, Send, RotateCcw } from 'lucide-react'
import type { PhotoAnalysis, ReportCategory, ReportUrgency } from '../api'
import { cardSx, facilityColors } from '../theme'

export interface ReportDraft {
  objectLabel: string
  issueDescription: string
  category: ReportCategory
  urgency: ReportUrgency
  locationDescription: string
}

interface ReportAnalysisStepProps {
  photo: string
  analysis: PhotoAnalysis
  draft: ReportDraft
  onDraftChange: (draft: ReportDraft) => void
  onSubmit: () => void
  onRetake: () => void
  submitting: boolean
  error: string | null
}

const CATEGORY_OPTIONS: { value: ReportCategory; label: string }[] = [
  { value: 'office_equipment', label: 'ציוד משרדי' },
  { value: 'air_conditioning', label: 'מיזוג אוויר' },
  { value: 'lighting', label: 'תאורה' },
  { value: 'electricity', label: 'חשמל' },
  { value: 'plumbing', label: 'אינסטלציה' },
  { value: 'network', label: 'תקשוב' },
  { value: 'furniture', label: 'ריהוט' },
  { value: 'cleaning', label: 'ניקיון' },
  { value: 'other', label: 'אחר' },
]

const URGENCY_OPTIONS: { value: ReportUrgency; label: string; color: string }[] = [
  { value: 'low', label: 'נמוכה', color: facilityColors.success },
  { value: 'medium', label: 'בינונית', color: facilityColors.warning },
  { value: 'high', label: 'גבוהה', color: facilityColors.danger },
]

function DetailRow({
  Icon,
  label,
  value,
  accentColor,
}: {
  Icon: typeof MapPin
  label: string
  value: string
  accentColor?: string
}) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Icon size={20} color={facilityColors.primary} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.75rem', color: facilityColors.textMuted }}>
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 600, color: facilityColors.text, wordBreak: 'break-word' }}>
          {value || '—'}
        </Typography>
      </Box>
      {accentColor && (
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: accentColor }} />
      )}
    </Paper>
  )
}

// Screen 3: what the model found, in the same card rhythm as the rest of the
// mode, with an edit mode so nothing is submitted that the user did not agree
// to.
export default function ReportAnalysisStep({
  photo,
  analysis,
  draft,
  onDraftChange,
  onSubmit,
  onRetake,
  submitting,
  error,
}: ReportAnalysisStepProps) {
  const [editing, setEditing] = useState(analysis.source === 'unavailable')

  const update = (patch: Partial<ReportDraft>) => onDraftChange({ ...draft, ...patch })
  const urgency = URGENCY_OPTIONS.find((option) => option.value === draft.urgency)
  const canSubmit =
    draft.objectLabel.trim().length >= 2 && draft.issueDescription.trim().length >= 2

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
      <Box
        component="img"
        src={photo}
        alt="התמונה שצולמה"
        sx={{
          width: '100%',
          maxHeight: 210,
          objectFit: 'cover',
          borderRadius: '18px',
          border: `1px solid ${facilityColors.cardBorder}`,
        }}
      />

      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: facilityColors.text }}>
          {analysis.source === 'ai' ? 'זיהינו את התקלה' : 'השלמת פרטי הדיווח'}
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: facilityColors.textMuted }}>
          {analysis.source === 'ai'
            ? `ה-AI זיהה את הפריט והתקלה${
                analysis.confidence ? ` · ודאות ${Math.round(analysis.confidence * 100)}%` : ''
              }`
            : 'הזיהוי האוטומטי אינו זמין כעת — יש למלא את הפרטים ידנית'}
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {editing ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="הפריט"
            value={draft.objectLabel}
            onChange={(event) => update({ objectLabel: event.target.value })}
            fullWidth
          />
          <TextField
            label="התקלה"
            value={draft.issueDescription}
            onChange={(event) => update({ issueDescription: event.target.value })}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="מיקום"
            value={draft.locationDescription}
            onChange={(event) => update({ locationDescription: event.target.value })}
            placeholder="בניין, קומה, חדר"
            fullWidth
          />
          <TextField
            select
            label="סוג תקלה"
            value={draft.category}
            onChange={(event) => update({ category: event.target.value as ReportCategory })}
            fullWidth
          >
            {CATEGORY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="דחיפות"
            value={draft.urgency}
            onChange={(event) => update({ urgency: event.target.value as ReportUrgency })}
            fullWidth
          >
            {URGENCY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <DetailRow
            Icon={Armchair}
            label={draft.objectLabel || 'הפריט'}
            value={draft.issueDescription}
          />
          <DetailRow Icon={MapPin} label="מיקום" value={draft.locationDescription} />
          <DetailRow
            Icon={AlertTriangle}
            label="דחיפות"
            value={urgency?.label ?? ''}
            accentColor={urgency?.color}
          />
        </Box>
      )}

      <Button
        variant="contained"
        disableElevation
        onClick={onSubmit}
        disabled={submitting || !canSubmit}
        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send size={18} />}
        sx={{ bgcolor: facilityColors.primary, '&:hover': { bgcolor: facilityColors.primaryDark } }}
      >
        שלח דיווח
      </Button>

      <Button
        variant="outlined"
        onClick={() => setEditing((value) => !value)}
        startIcon={<Pencil size={18} />}
        sx={{
          color: facilityColors.primary,
          borderColor: facilityColors.cardBorder,
          bgcolor: facilityColors.card,
        }}
      >
        {editing ? 'סיום עריכה' : 'ערוך פרטים'}
      </Button>

      <Button
        onClick={onRetake}
        startIcon={<RotateCcw size={18} />}
        sx={{ color: facilityColors.textMuted }}
      >
        צלם שוב
      </Button>
    </Box>
  )
}
