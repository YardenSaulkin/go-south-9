import { useState } from 'react'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import { navigate } from '../../navigation'
import FacilityScreen from '../components/FacilityScreen'
import CameraCapture from '../components/CameraCapture'
import ReportAnalysisStep, { type ReportDraft } from '../components/ReportAnalysisStep'
import ReportConfirmationStep from '../components/ReportConfirmationStep'
import { analyzePhoto, createReport, type FacilityReport, type PhotoAnalysis } from '../api'
import { facilityColors } from '../theme'

type Step = 'camera' | 'analysis' | 'confirmation'

// The "צלם וטפל" flow: camera → AI analysis → submission → confirmation.
// The steps share one page because the photo only ever lives in memory here,
// and each step is its own component.
export default function ReportFlowPage() {
  const [step, setStep] = useState<Step>('camera')
  const [photo, setPhoto] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null)
  const [draft, setDraft] = useState<ReportDraft | null>(null)
  const [report, setReport] = useState<FacilityReport | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCapture = async (photoDataUrl: string) => {
    setPhoto(photoDataUrl)
    setStep('analysis')
    setAnalyzing(true)
    setError(null)

    try {
      const result = await analyzePhoto(photoDataUrl)
      setAnalysis(result)
      setDraft({
        objectLabel: result.objectLabel,
        issueDescription: result.issueDescription,
        category: result.category,
        urgency: result.urgency,
        locationDescription: result.locationDescription,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ניתוח התמונה נכשל')
      setStep('camera')
      setPhoto(null)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSubmit = async () => {
    if (!draft || !analysis || !photo) return
    setSubmitting(true)
    setError(null)

    try {
      const created = await createReport({
        idempotencyKey: crypto.randomUUID(),
        objectLabel: draft.objectLabel.trim(),
        issueDescription: draft.issueDescription.trim(),
        category: draft.category,
        urgency: draft.urgency,
        locationDescription: draft.locationDescription.trim() || undefined,
        photo,
        aiConfidence: analysis.source === 'ai' ? analysis.confidence : undefined,
        aiAnalysis: analysis.source === 'ai' ? { ...analysis } : undefined,
      })
      setReport(created)
      setStep('confirmation')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'שליחת הדיווח נכשלה')
    } finally {
      setSubmitting(false)
    }
  }

  const restart = () => {
    setStep('camera')
    setPhoto(null)
    setAnalysis(null)
    setDraft(null)
    setReport(null)
    setError(null)
  }

  if (step === 'camera') {
    return (
      <>
        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{ position: 'fixed', insetInline: 16, top: 84, zIndex: 1400 }}
          >
            {error}
          </Alert>
        )}
        <CameraCapture onCapture={handleCapture} onClose={() => navigate('/facility')} />
      </>
    )
  }

  if (step === 'analysis') {
    return (
      <FacilityScreen
        title="צלם וטפל"
        subtitle="בדוק את הפרטים לפני השליחה"
        onBack={restart}
        activeTab="home"
      >
        {analyzing || !analysis || !draft || !photo ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <CircularProgress sx={{ color: facilityColors.primary }} />
            <Typography sx={{ color: facilityColors.textMuted }}>מנתח את התמונה…</Typography>
          </Box>
        ) : (
          <ReportAnalysisStep
            photo={photo}
            analysis={analysis}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={handleSubmit}
            onRetake={restart}
            submitting={submitting}
            error={error}
          />
        )}
      </FacilityScreen>
    )
  }

  return (
    <FacilityScreen
      title="אישור ושליחת קריאה"
      onBack={() => navigate('/facility')}
      activeTab="home"
    >
      {report && (
        <ReportConfirmationStep
          report={report}
          onFollow={() => navigate('/facility/reports')}
          onAnother={restart}
        />
      )}
    </FacilityScreen>
  )
}
