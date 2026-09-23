import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Snackbar,
  CircularProgress,
  Alert,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import { ChevronRight } from 'lucide-react'
import PackingUnitSummaryModal from './PackingUnitSummaryModal'
import { fetchEligibleItems, createPackingUnit, type EligibleItem } from '../lib/api'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

const PACKAGING_TYPES = [
  { label: 'קרטון אישי', value: 'personal_carton' },
  { label: 'קרטון מקצועי', value: 'professional_carton' },
  { label: 'פלט', value: 'pallet' },
  { label: 'זולב', value: 'dolav' },
  { label: 'גוש', value: 'bulk' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontFamily: 'Heebo, sans-serif',
        fontWeight: 700,
        fontSize: '0.95rem',
        color: '#3d2008',
        textAlign: 'right',
        mb: 1,
      }}
    >
      {children}
    </Typography>
  )
}

export interface PackingUnitPageProps {
  onBack: () => void
  user?: { name: string; personalNumber?: string; role?: string } | null
  orgScope?: { mador?: string } | null
  userId: string | null
  orgScopeId: string | null
}

export default function PackingUnitPage({ onBack, user, orgScope, userId, orgScopeId }: PackingUnitPageProps) {
  const [packingUnitType, setPackingUnitType] = useState('personal_carton')
  const [items, setItems] = useState<(EligibleItem & { checked: boolean })[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [sourceUnit, setSourceUnit] = useState('')
  const [sourceBranch, setSourceBranch] = useState('')
  const [sourceWarehouse, setSourceWarehouse] = useState('')
  const [sourceRoom, setSourceRoom] = useState('')
  const [destBuilding, setDestBuilding] = useState('')
  const [destFloor, setDestFloor] = useState('')
  const [destRoom, setDestRoom] = useState('')
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('לא כל השדות הנדרשים מולאו')
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [displaySerial, setDisplaySerial] = useState('')

  const loadItems = () => {
    if (!orgScopeId || !userId) return
    setItemsLoading(true)
    setItemsError(null)
    fetchEligibleItems(orgScopeId, userId)
      .then((fetched) => setItems(fetched.map((item) => ({ ...item, checked: false }))))
      .catch((e) => setItemsError(e instanceof Error ? e.message : 'שגיאה בטעינת פריטים'))
      .finally(() => setItemsLoading(false))
  }

  useEffect(() => {
    loadItems()
  }, [orgScopeId, userId])

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)))
  }

  const anyItemChecked = items.some((item) => item.checked)
  const allFilled =
    destBuilding.trim() &&
    destFloor.trim() &&
    destRoom.trim() &&
    (packingUnitType === 'personal_carton' || anyItemChecked)

  const handleFinish = async () => {
    if (!allFilled) {
      setToastMsg('לא כל השדות הנדרשים מולאו')
      setToastOpen(true)
      return
    }
    if (!orgScopeId || !userId) {
      setToastMsg('חסרים פרטי משתמש')
      setToastOpen(true)
      return
    }

    const typeLabel = PACKAGING_TYPES.find((t) => t.value === packingUnitType)?.label ?? packingUnitType
    const descParts = [typeLabel, sourceUnit && `יחידה ${sourceUnit}`, sourceBranch && `ענף ${sourceBranch}`].filter(Boolean)
    const description = descParts.join(' - ')

    const selectedItems = items
      .filter((item) => item.checked)
      .map((item) => ({ itemId: item.id, quantity: item.quantity }))

    const sourceParts = [sourceWarehouse, sourceRoom].filter(Boolean)

    setSubmitting(true)
    try {
      const result = await createPackingUnit(
        {
          idempotencyKey: crypto.randomUUID(),
          orgScopeId,
          description,
          packingUnitType,
          ...(sourceParts.length > 0 && { sourceDescription: sourceParts.join(', ') }),
          destination: {
            building: destBuilding.trim(),
            floor: destFloor.trim(),
            room: destRoom.trim(),
          },
          items: selectedItems,
        },
        userId,
      )
      setDisplaySerial(result.displaySerial)
      setSummaryOpen(true)
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : 'שגיאה ביצירת יחידת האריזה')
      setToastOpen(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleContinuePacking = () => {
    setSummaryOpen(false)
    loadItems()
  }

  const handleExitPacking = () => {
    setSummaryOpen(false)
    onBack()
  }

  const sectionCardSx = {
    backgroundColor: 'rgba(240, 210, 155, 0.65)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderRadius: '18px',
    p: 2,
    border: '1px solid rgba(255,255,255,0.25)',
    boxShadow: '0 4px 18px rgba(0,0,0,0.1)',
  }

  const inputSx = {
    backgroundColor: 'rgba(246, 230, 195, 0.85)',
    border: '1px solid rgba(200, 160, 100, 0.4)',
    borderRadius: '12px',
    padding: '10px 14px',
    fontFamily: 'Heebo, sans-serif',
    fontSize: '0.9rem',
    color: '#3d2008',
    outline: 'none',
    width: '100%',
    direction: 'rtl' as const,
    boxSizing: 'border-box' as const,
  }

  return (
    <ThemeProvider theme={theme}>
      <Box
        dir="rtl"
        sx={{
          width: '100vw',
          height: 'calc(100dvh - 62px)',
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
        {/* Overlay */}
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
            יחידת אריזה
          </Typography>
        </Box>

        {/* Scrollable form */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            overflowY: 'auto',
            px: '5vw',
            pt: 1,
            pb: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}
        >
          {/* מאיפה אורזים */}
          <Box sx={sectionCardSx}>
            <SectionLabel>מאיפה אורזים?</SectionLabel>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Box
                  component="input"
                  value={sourceUnit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSourceUnit(e.target.value.replace(/\D/g, '').slice(0, 2))
                  }
                  placeholder="קוד יחידה"
                  inputMode="numeric"
                  maxLength={2}
                  sx={inputSx}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box
                  component="input"
                  value={sourceBranch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSourceBranch(e.target.value.replace(/\D/g, '').slice(0, 2))
                  }
                  placeholder="קוד ענף"
                  inputMode="numeric"
                  maxLength={2}
                  sx={inputSx}
                />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Box
                  component="input"
                  value={sourceWarehouse}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSourceWarehouse(e.target.value)}
                  placeholder="שם מחסן"
                  sx={inputSx}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box
                  component="input"
                  value={sourceRoom}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSourceRoom(e.target.value)}
                  placeholder="מספר חדר"
                  sx={inputSx}
                />
              </Box>
            </Box>
          </Box>

          {/* בחר סוג אריזה */}
          <Box sx={sectionCardSx}>
            <SectionLabel>בחר סוג אריזה</SectionLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {PACKAGING_TYPES.map((type) => {
                const selected = packingUnitType === type.value
                return (
                  <Box
                    key={type.value}
                    onClick={() => setPackingUnitType(type.value)}
                    sx={{
                      px: 2,
                      py: '6px',
                      borderRadius: '999px',
                      backgroundColor: selected ? '#8B5E3C' : 'rgba(246, 230, 195, 0.85)',
                      color: selected ? 'white' : '#6e4e37',
                      fontFamily: 'Heebo, sans-serif',
                      fontWeight: selected ? 700 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                      border: selected
                        ? '1px solid rgba(255,255,255,0.2)'
                        : '1px solid rgba(200, 160, 100, 0.4)',
                      boxShadow: selected ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {type.label}
                  </Box>
                )
              })}
            </Box>
          </Box>

          {/* בחר פריטים לארוז */}
          <Box sx={sectionCardSx}>
            <SectionLabel>בחר פריטים לארוז</SectionLabel>
            {itemsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={28} sx={{ color: '#8B5E3C' }} />
              </Box>
            ) : itemsError ? (
              <Alert
                severity="error"
                onClose={() => setItemsError(null)}
                sx={{ fontFamily: 'Heebo, sans-serif', borderRadius: '12px' }}
              >
                {itemsError}
              </Alert>
            ) : items.length === 0 ? (
              <Typography
                sx={{
                  fontFamily: 'Heebo, sans-serif',
                  fontSize: '0.88rem',
                  color: '#8B5E3C',
                  textAlign: 'center',
                  py: 1,
                }}
              >
                אין פריטים זמינים לאריזה
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {items.map((item) => (
                  <Box
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      borderRadius: '12px',
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      userSelect: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      border: item.checked
                        ? '1px solid rgba(139, 94, 60, 0.6)'
                        : '1px solid rgba(200, 160, 100, 0.3)',
                      backgroundColor: item.checked
                        ? 'rgba(139, 94, 60, 0.35)'
                        : 'rgba(246, 230, 195, 0.85)',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: 'Heebo, sans-serif',
                        fontSize: '0.85rem',
                        color: item.checked ? '#3d2008' : '#6e4e37',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      כמות: {item.quantity}
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: 'Heebo, sans-serif',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#3d2008',
                      }}
                    >
                      {item.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* לאן שולחים */}
          <Box sx={sectionCardSx}>
            <SectionLabel>לאן שולחים?</SectionLabel>
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Box
                  component="input"
                  value={destRoom}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestRoom(e.target.value)}
                  placeholder="מספר חדר"
                  sx={inputSx}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box
                  component="input"
                  value={destFloor}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestFloor(e.target.value)}
                  placeholder="קומה"
                  sx={inputSx}
                />
              </Box>
            </Box>
            <Box
              component="input"
              value={destBuilding}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestBuilding(e.target.value)}
              placeholder="בניין"
              sx={inputSx}
            />
          </Box>
        </Box>

        {/* Fixed bottom button */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 2,
            flexShrink: 0,
            px: '5vw',
            pt: 1.5,
            pb: 'max(env(safe-area-inset-bottom), 20px)',
            backgroundColor: 'transparent',
          }}
        >
          <Box
            onClick={submitting ? undefined : handleFinish}
            sx={{
              width: '100%',
              py: '14px',
              borderRadius: '999px',
              backgroundColor: allFilled && !submitting ? '#8B5E3C' : 'rgba(139, 94, 60, 0.4)',
              color: allFilled && !submitting ? 'white' : 'rgba(255,255,255,0.6)',
              fontFamily: 'Heebo, sans-serif',
              fontWeight: 700,
              fontSize: '1.05rem',
              textAlign: 'center',
              cursor: allFilled && !submitting ? 'pointer' : 'default',
              boxShadow: allFilled && !submitting ? '0 4px 16px rgba(0,0,0,0.25)' : 'none',
              letterSpacing: 0.5,
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              ...(allFilled && !submitting && {
                '&:active': {
                  transform: 'scale(0.97)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                },
              }),
            }}
          >
            {submitting ? <CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.8)' }} /> : 'סיום אריזה'}
          </Box>
        </Box>

        {/* Packing Unit Summary Modal */}
        <PackingUnitSummaryModal
          open={summaryOpen}
          serialNumber={displaySerial}
          source={{
            unit: sourceUnit || '',
            anaf: sourceBranch || '',
            mador: orgScope?.mador || '',
            room: [sourceWarehouse, sourceRoom].filter(Boolean).join(', '),
          }}
          destination={{
            building: destBuilding,
            floor: destFloor,
            room: destRoom,
          }}
          madorSupervisor="שם אחראי"
          roomSupervisor="שם אחראי"
          packerName={
            user?.name
              ? `${user.name} ${user.personalNumber || ''}`
              : 'שם אורז'
          }
          onContinue={handleContinuePacking}
          onExit={handleExitPacking}
        />

        {/* Toast */}
        <Snackbar
          open={toastOpen}
          autoHideDuration={2500}
          onClose={() => setToastOpen(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          message={toastMsg}
          slotProps={{
            content: {
              sx: {
                backgroundColor: '#5a3010',
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.9rem',
                borderRadius: '12px',
                direction: 'rtl',
              },
            },
          }}
        />
      </Box>
    </ThemeProvider>
  )
}
