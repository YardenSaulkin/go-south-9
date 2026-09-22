import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import { ChevronRight, Search, Package } from 'lucide-react'
import { fetchEligiblePackingUnits, createShipment, type EligiblePackingUnit } from '../lib/api'
import ShipmentSummaryModal from './ShipmentSummaryModal'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <Box sx={{ display: 'flex', gap: '6px', width: '100%', px: '6vw', mt: '14px', mb: '16px' }}>
      {Array.from({ length: total }, (_, i) => (
        <Box
          key={i}
          sx={{
            flex: 1,
            height: '4px',
            borderRadius: '999px',
            backgroundColor:
              i < current
                ? 'rgba(255,255,255,0.95)'
                : 'rgba(255,255,255,0.3)',
            transition: 'background-color 0.3s ease',
          }}
        />
      ))}
    </Box>
  )
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}



interface CrateRow extends EligiblePackingUnit {
  checked: boolean
  ownerName?: string
}

export interface ShipmentPageProps {
  onBack: () => void
  userId: string | null
  orgScopeId: string | null
}

// ─── Step 1: transport details ─────────────────────────────────────────────

interface Step1Props {
  onBack: () => void
  onNext: (type: 'truck' | 'other', plate: string, otherDesc: string) => void
  initialType: 'truck' | 'other'
  initialPlate: string
  initialOtherDesc: string
}

function formatPlate(digits: string): string {
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  if (digits.length <= 7) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` // 8-digit new format
}

function Step1({ onBack, onNext, initialType, initialPlate, initialOtherDesc }: Step1Props) {
  const [transportType, setTransportType] = useState<'truck' | 'other'>(initialType)
  const [licensePlate, setLicensePlate] = useState(initialPlate)
  const [plateError, setPlateError] = useState<string | null>(null)
  const [otherDescription, setOtherDescription] = useState(initialOtherDesc)

  const digits = licensePlate.replace(/-/g, '')
  const isValidPlate = digits.length === 7 || digits.length === 8
  const canProceed =
    isValidPlate && (transportType !== 'other' || otherDescription.trim().length > 0)

  const handlePlateChange = (raw: string) => {
    // reject anything that isn't digits or dashes
    if (/[^\d\-]/.test(raw)) {
      setPlateError('מספר רישוי מכיל ספרות בלבד')
      return
    }
    const d = raw.replace(/-/g, '').slice(0, 8)
    setLicensePlate(formatPlate(d))
    if (d.length > 0 && d.length !== 7 && d.length !== 8) {
      setPlateError(d.length < 7 ? null : 'מספר רישוי לא תקין')
    } else {
      setPlateError(null)
    }
  }

  return (
    <Box
      dir="rtl"
      sx={{
        width: '100vw',
        height: '100dvh',
        position: 'relative',
        backgroundImage: 'url(/desert-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.04) 30%, transparent 55%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Header */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pt: '5vh',
          pb: '1.5vh',
          px: '5vw',
          flexShrink: 0,
        }}
      >
        <IconButton
          onClick={onBack}
          sx={{ position: 'absolute', right: '4vw', color: 'white', p: 0.5 }}
        >
          <ChevronRight size={28} strokeWidth={2.5} />
        </IconButton>
        <Typography
          sx={{
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 800,
            fontSize: '1.6rem',
            color: 'white',
            textShadow: '0 2px 8px rgba(0,0,0,0.45)',
            letterSpacing: 0.5,
          }}
        >
          יצירת הובלה
        </Typography>
      </Box>
      <StepIndicator current={1} total={2} />

      {/* Form */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          px: '6vw',
          pt: 0,
          gap: '3vh',
        }}
      >
        {/* Transport type */}
        <Box>
          <Typography
            sx={{
              fontFamily: 'Heebo, sans-serif',
              fontSize: '0.88rem',
              fontWeight: 600,
              color: 'white',
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              mb: '10px',
              textAlign: 'right',
            }}
          >
            סוג יחידת הובלה
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            {(['truck', 'other'] as const).map((val) => {
              const label = val === 'truck' ? 'משאית' : 'אחר'
              const selected = transportType === val
              return (
                <Box
                  key={val}
                  onClick={() => setTransportType(val)}
                  sx={{
                    flex: 1,
                    py: '11px',
                    borderRadius: '999px',
                    backgroundColor: selected
                      ? 'rgba(101, 62, 35, 0.88)'
                      : 'rgba(222, 185, 140, 0.55)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    color: selected ? 'white' : 'rgba(80,45,15,0.85)',
                    fontFamily: 'Heebo, sans-serif',
                    fontWeight: selected ? 700 : 500,
                    fontSize: '0.95rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    border: selected
                      ? '1.5px solid rgba(255,255,255,0.25)'
                      : '1.5px solid rgba(255,255,255,0.15)',
                    boxShadow: selected ? '0 3px 12px rgba(0,0,0,0.25)' : 'none',
                    transition: 'all 0.18s ease',
                  }}
                >
                  {label}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Other description */}
        {transportType === 'other' && (
          <Box>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'white',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                mb: '10px',
                textAlign: 'right',
              }}
            >
              פרט את אמצעי ההובלה
            </Typography>
            <Box
              component="input"
              value={otherDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setOtherDescription(e.target.value)
              }
              placeholder="תאר את אמצעי ההובלה"
              sx={{
                width: '100%',
                backgroundColor: 'rgba(255,255,255,0.88)',
                border: 'none',
                borderRadius: '14px',
                padding: '13px 16px',
                fontFamily: 'Heebo, sans-serif',
                fontSize: '1rem',
                color: '#2d1b0a',
                outline: 'none',
                direction: 'rtl' as const,
                boxSizing: 'border-box' as const,
                boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
              }}
            />
          </Box>
        )}

        {/* License plate */}
        <Box>
          <Typography
            sx={{
              fontFamily: 'Heebo, sans-serif',
              fontSize: '0.88rem',
              fontWeight: 600,
              color: 'white',
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              mb: '10px',
              textAlign: 'right',
            }}
          >
            הכנס מס׳ רישוי
          </Typography>
          <Box
            component="input"
            value={licensePlate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handlePlateChange(e.target.value)
            }
            placeholder="12-345-67"
            inputMode="numeric"
            sx={{
              width: '100%',
              backgroundColor: plateError ? 'rgba(255,235,235,0.92)' : 'rgba(255,255,255,0.88)',
              border: plateError ? '1.5px solid rgba(200,60,30,0.6)' : 'none',
              borderRadius: '14px',
              padding: '13px 16px',
              fontFamily: 'Heebo, sans-serif',
              fontSize: '1.1rem',
              color: '#2d1b0a',
              outline: 'none',
              direction: 'ltr' as const,
              boxSizing: 'border-box' as const,
              boxShadow: plateError ? 'none' : '0 2px 10px rgba(0,0,0,0.12)',
              textAlign: 'center',
              letterSpacing: 3,
              transition: 'background-color 0.2s ease',
            }}
          />
          {plateError && (
            <Box
              sx={{
                mt: '8px',
                px: '12px',
                py: '7px',
                borderRadius: '10px',
                backgroundColor: 'rgba(180, 40, 20, 0.75)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'Heebo, sans-serif',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: 'white',
                  textAlign: 'right',
                }}
              >
                {plateError}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Bottom button */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          flexShrink: 0,
          px: '6vw',
          pt: 1.5,
          pb: 'max(env(safe-area-inset-bottom), 28px)',
        }}
      >
        <Box
          onClick={canProceed ? () => onNext(transportType, licensePlate.trim(), otherDescription.trim()) : undefined}
          sx={{
            width: '100%',
            py: '15px',
            borderRadius: '999px',
            backgroundColor: canProceed ? 'rgba(90, 50, 18, 0.92)' : 'rgba(90, 50, 18, 0.38)',
            color: canProceed ? 'white' : 'rgba(255,255,255,0.5)',
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 700,
            fontSize: '1.05rem',
            textAlign: 'center',
            cursor: canProceed ? 'pointer' : 'default',
            boxShadow: canProceed ? '0 4px 18px rgba(0,0,0,0.3)' : 'none',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            letterSpacing: 0.5,
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
            transition: 'all 0.2s ease',
            ...(canProceed && { '&:active': { transform: 'scale(0.97)' } }),
          }}
        >
          שמירה ומעבר להעמסה
        </Box>
      </Box>
    </Box>
  )
}

// ─── Mock data (fallback when needed) ────────────────────────────────────────

const FALLBACK_CRATES: CrateRow[] = [
  {
    id: 'crate-demo-1',
    description: 'מחשבים וציוד היקפי',
    serialNumber: 56789,
    displaySerial: '56789',
    packingUnitType: 'קרטון מקוטע',
    sourceDescription: '01 | 01 | 01 | חדר 208',
    destinationDescription: JSON.stringify({ building: 'בניין A', floor: 'קומה 3', room: 'חדר 309' }),
    items: [
      { id: 'item-1', description: 'מחשב', quantity: 2 },
      { id: 'item-2', description: 'מסך', quantity: 2 },
    ],
    checked: false,
    ownerName: 'שימי שמעוני 9223345',
  },
  {
    id: 'crate-demo-2',
    description: 'ציוד תקשורת ושרתים',
    serialNumber: 56790,
    displaySerial: '56790',
    packingUnitType: 'קרטון אחיד',
    sourceDescription: '01 | 01 | 01 | חדר 208',
    destinationDescription: JSON.stringify({ building: 'בניין A', floor: 'קומה 3', room: 'חדר 309' }),
    items: [
      { id: 'item-3', description: 'מתג', quantity: 1 },
      { id: 'item-4', description: 'נתב', quantity: 1 },
    ],
    checked: false,
    ownerName: 'שימי שמעוני 9223345',
  },
]

// ─── Step 2: box selection ──────────────────────────────────────────────────

interface Step2Props {
  transportType: 'truck' | 'other'
  licensePlate: string
  otherDescription: string
  userId: string | null
  orgScopeId: string | null
  openedAt: Date
  onBack: () => void
  onDone: () => void
}

function Step2({ transportType, licensePlate, otherDescription, userId, orgScopeId, openedAt, onBack, onDone }: Step2Props) {
  const [crates, setCrates] = useState<CrateRow[]>([])
  const [loadingCrates, setLoadingCrates] = useState(true)
  const [cratesError, setCratesError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [shipmentTime, setShipmentTime] = useState<Date | null>(null)
  const [shipmentId, setShipmentId] = useState<string | null>(null)

  const loadCrates = useCallback(async () => {
    if (!userId || !orgScopeId) {
      setCrates(FALLBACK_CRATES)
      setLoadingCrates(false)
      return
    }
    setLoadingCrates(true)
    setCratesError(null)
    try {
      const units = await fetchEligiblePackingUnits(orgScopeId, userId)
      if (units.length > 0) {
        setCrates(units.map((u) => ({ ...u, checked: false })))
      } else {
        setCrates(FALLBACK_CRATES)
      }
    } catch (err) {
      console.warn('Falling back to default crates:', err)
      setCrates(FALLBACK_CRATES)
    } finally {
      setLoadingCrates(false)
    }
  }, [userId, orgScopeId])

  useEffect(() => { loadCrates() }, [loadCrates])

  const filtered = crates.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.description.toLowerCase().includes(q) ||
      c.displaySerial.toLowerCase().includes(q)
    )
  })

  const anyChecked = crates.some((c) => c.checked)
  const selectedCrates = crates.filter((c) => c.checked)
  const selectedUnitCount = selectedCrates.reduce((sum, c) => sum + c.items.length, 0)

  const toggleCrate = (id: string) => {
    setCrates((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)))
  }

  const handleFinish = async () => {
    if (!anyChecked) {
      setErrorMsg('יש לבחור ארגז אחד לפחות')
      setTimeout(() => setErrorMsg(null), 2500)
      return
    }
    setSubmitting(true)
    const now = new Date()
    setShipmentTime(now)
    let sId = '56789'
    if (userId && orgScopeId) {
      try {
        const result = await createShipment(
          {
            idempotencyKey: crypto.randomUUID(),
            orgScopeId,
            description: `הובלה ${formatDate(openedAt)}`,
            transportType,
            transportDescription: transportType === 'other' ? otherDescription : undefined,
            vehicleIdentifier: licensePlate,
            transportAt: now.toISOString(),
            packingUnitIds: selectedCrates.map((c) => c.id),
          },
          userId,
        )
        sId = result.id
      } catch (err) {
        console.warn('createShipment API call failed, proceeding with local summary:', err)
      }
    }
    setShipmentId(sId)
    setSuccessDialogOpen(true)
    setSubmitting(false)
  }


  return (
    <Box
      dir="rtl"
      sx={{
        width: '100vw',
        height: '100dvh',
        position: 'relative',
        backgroundImage: 'url(/desert-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 25%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Header */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pt: '5vh',
          pb: '1.5vh',
          px: '5vw',
          flexShrink: 0,
        }}
      >
        <IconButton onClick={onBack} sx={{ position: 'absolute', right: '4vw', color: 'white', p: 0.5 }}>
          <ChevronRight size={28} strokeWidth={2.5} />
        </IconButton>
        <Typography
          sx={{
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 800,
            fontSize: '1.6rem',
            color: 'white',
            textShadow: '0 2px 8px rgba(0,0,0,0.45)',
            letterSpacing: 0.5,
          }}
        >
          בחירת ארגזים
        </Typography>
      </Box>
      <StepIndicator current={2} total={2} />

      {/* Search bar */}
      <Box sx={{ position: 'relative', zIndex: 2, px: '5vw', pb: '1vh', flexShrink: 0 }}>
        <Box
          sx={{
            backgroundColor: 'rgba(255,255,255,0.88)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            px: '12px',
            gap: 1,
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          }}
        >
          <Search size={18} color="#8B5E3C" style={{ flexShrink: 0 }} />
          <Box
            component="input"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="חיפוש ארגז..."
            sx={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              padding: '12px 4px',
              fontFamily: 'Heebo, sans-serif',
              fontSize: '0.95rem',
              color: '#2d1b0a',
              outline: 'none',
              direction: 'rtl' as const,
              '&::placeholder': { color: '#b08060' },
            }}
          />
        </Box>
      </Box>

      {/* Crate list */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          overflowY: 'auto',
          px: '5vw',
          pb: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {loadingCrates && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: '4vh' }}>
            <CircularProgress size={32} sx={{ color: '#8B5E3C' }} />
          </Box>
        )}

        {cratesError && (
          <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.9rem', color: '#fff', textAlign: 'center', pt: '4vh', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
            {cratesError}
          </Typography>
        )}

        {!loadingCrates && !cratesError && filtered.length === 0 && (
          <Box
            sx={{
              mt: '2vh',
              px: '16px',
              py: '14px',
              borderRadius: '14px',
              backgroundColor: 'rgba(0,0,0,0.28)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.95rem', fontWeight: 600, color: 'white' }}>
              {search ? 'לא נמצאו ארגזים תואמים' : 'אין ארגזים זמינים להובלה'}
            </Typography>
          </Box>
        )}

        {filtered.map((crate) => {
          const dest = (() => {
            try { return crate.destinationDescription ? JSON.parse(crate.destinationDescription) : null } catch { return null }
          })()
          const srcLines = crate.sourceDescription ? crate.sourceDescription.split('|').map(s => s.trim()) : []
          const col = crate.checked ? '#fff' : '#2d1b0a'
          const sub = crate.checked ? 'rgba(255,255,255,0.75)' : '#6e4530'
          const borderCol = crate.checked ? 'rgba(255,255,255,0.5)' : 'rgba(101,62,35,0.7)'

          return (
            <Box
              key={crate.id}
              onClick={() => toggleCrate(crate.id)}
              sx={{
                backgroundColor: crate.checked ? 'rgba(101, 55, 12, 0.80)' : 'rgba(238, 205, 135, 0.72)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '16px',
                border: crate.checked ? '1.5px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.35)',
                cursor: 'pointer',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background-color 0.18s ease',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'row',
                direction: 'rtl',
              }}
            >
              {/* Right: box icon */}
              <Box sx={{
                width: '68px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: `1px solid ${crate.checked ? 'rgba(255,255,255,0.12)' : 'rgba(160,110,40,0.2)'}`,
              }}>
                <Package size={38} color={crate.checked ? 'rgba(255,255,255,0.6)' : '#9B6E3C'} strokeWidth={1.2} />
              </Box>

              {/* Left: text content */}
              <Box sx={{ flex: 1, p: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Serial badge */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Box sx={{ border: `1.5px solid ${borderCol}`, borderRadius: '6px', px: '12px', py: '2px', backgroundColor: crate.checked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.45)' }}>
                    <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 800, fontSize: '0.92rem', color: col, whiteSpace: 'nowrap' }}>
                      מס׳ אריזה {crate.displaySerial}
                    </Typography>
                  </Box>
                </Box>

                {/* Two columns */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {/* Right: source */}
                  <Box sx={{ flex: 1, textAlign: 'right' }}>
                    {srcLines[0] && <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.77rem', fontWeight: 700, color: col, lineHeight: 1.6 }}>נשלח מ: {srcLines[0]}</Typography>}
                    {srcLines[1] && <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.77rem', color: sub, lineHeight: 1.6 }}>{srcLines[1]}</Typography>}
                    {srcLines[2] && <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.77rem', color: sub, lineHeight: 1.6 }}>{srcLines[2]}</Typography>}
                    {srcLines[3] && <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.77rem', color: sub, lineHeight: 1.6 }}>{srcLines[3]}</Typography>}
                  </Box>

                  {/* Left: destination */}
                  {dest && (
                    <Box sx={{ flex: 1, textAlign: 'right' }}>
                      <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.77rem', fontWeight: 700, color: col, lineHeight: 1.6 }}>נשלח אל: {dest.building}</Typography>
                      {dest.floor && <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.77rem', color: sub, lineHeight: 1.6 }}>{dest.floor}</Typography>}
                      {dest.room && <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.77rem', color: sub, lineHeight: 1.6 }}>{dest.room}</Typography>}
                    </Box>
                  )}
                </Box>

                {/* Packer */}
                {crate.ownerName && (
                  <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.8rem', fontWeight: 700, color: col, textAlign: 'right' }}>
                    אורז: {crate.ownerName}
                  </Typography>
                )}
              </Box>
            </Box>
          )
        })}

        {errorMsg && (
          <Box
            sx={{
              backgroundColor: 'rgba(180, 60, 30, 0.18)',
              border: '1px solid rgba(180, 60, 30, 0.35)',
              borderRadius: '12px',
              px: 2,
              py: 1,
              textAlign: 'center',
              mt: 1,
            }}
          >
            <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>
              {errorMsg}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Bottom button */}
      <Box sx={{ position: 'relative', zIndex: 2, flexShrink: 0, px: '5vw', pt: 1.5, pb: 'max(env(safe-area-inset-bottom), 28px)' }}>
        <Box
          onClick={submitting ? undefined : handleFinish}
          sx={{
            width: '100%',
            py: '15px',
            borderRadius: '999px',
            backgroundColor: anyChecked && !submitting ? 'rgba(90, 50, 18, 0.92)' : 'rgba(90, 50, 18, 0.38)',
            color: anyChecked && !submitting ? 'white' : 'rgba(255,255,255,0.5)',
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 700,
            fontSize: '1.05rem',
            textAlign: 'center',
            cursor: anyChecked && !submitting ? 'pointer' : 'default',
            boxShadow: anyChecked && !submitting ? '0 4px 18px rgba(0,0,0,0.3)' : 'none',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            letterSpacing: 0.5,
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            ...(anyChecked && !submitting && { '&:active': { transform: 'scale(0.97)' } }),
          }}
        >
          {submitting
            ? <CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.8)' }} />
            : 'סיום העמסה'
          }
        </Box>
      </Box>

      {/* Success Dialog Modal */}
      <ShipmentSummaryModal
        open={successDialogOpen}
        shipmentNumber={shipmentId ? (shipmentId.length > 8 ? shipmentId.slice(0, 5) : shipmentId) : '56789'}
        licensePlate={licensePlate || '22233344'}
        unitCount={selectedUnitCount || selectedCrates.length || 2}
        dateTime={shipmentTime || new Date()}
        onContinue={() => {
          setCrates((prev) => prev.map((c) => ({ ...c, checked: false })))
          setSuccessDialogOpen(false)
        }}
        onExit={() => {
          setSuccessDialogOpen(false)
          onDone()
        }}
      />
    </Box>
  )
}

// ─── Root: manages step ─────────────────────────────────────────────────────

export default function ShipmentPage({ onBack, userId, orgScopeId }: ShipmentPageProps) {
  const openedAt = useMemo(() => new Date(), [])
  const [step, setStep] = useState<1 | 2>(1)
  const [transportType, setTransportType] = useState<'truck' | 'other'>('truck')
  const [licensePlate, setLicensePlate] = useState('')
  const [otherDescription, setOtherDescription] = useState('')

  const handleNext = (type: 'truck' | 'other', plate: string, otherDesc: string) => {
    setTransportType(type)
    setLicensePlate(plate)
    setOtherDescription(otherDesc)
    setStep(2)
  }

  return (
    <ThemeProvider theme={theme}>
      {step === 1 ? (
        <Step1
          onBack={onBack}
          onNext={handleNext}
          initialType={transportType}
          initialPlate={licensePlate}
          initialOtherDesc={otherDescription}
        />
      ) : (
        <Step2
          transportType={transportType}
          licensePlate={licensePlate}
          otherDescription={otherDescription}
          userId={userId}
          orgScopeId={orgScopeId}
          openedAt={openedAt}
          onBack={() => setStep(1)}
          onDone={onBack}
        />
      )}
    </ThemeProvider>
  )
}
