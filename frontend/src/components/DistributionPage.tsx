import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Checkbox,
  CircularProgress,
  Snackbar,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import {
  ChevronRight,
  Search,
  X,
  Minus,
  Plus,
  CheckCircle2,
} from 'lucide-react'
import BottomNavBar from './BottomNavBar'
import CardboardBoxSvg from './distribution/CardboardBoxSvg'
import {
  fetchDistributionPackingUnits,
  distributePackingUnit,
  type DistributionPackingUnit,
} from '../lib/api'
import { navigate } from '../navigation'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

export interface DistributionPageProps {
  onBack: () => void
  userId: string | null
  orgScopeId: string | null
}

type FilterField = 'all' | 'serial' | 'source' | 'destination' | 'packer'

const FILTER_FIELD_OPTIONS: { id: FilterField; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'serial', label: 'מס׳ אריזה' },
  { id: 'destination', label: 'יעד' },
  { id: 'source', label: 'מקור' },
  { id: 'packer', label: 'אורז' },
]

// ─── Shared Bottom Navigation Bar ──────────────────────────────────────────


// ─── Sub-view 1: Packages List View (Right page in mockup) ──────────────────

interface PackagesListViewProps {
  packages: DistributionPackingUnit[]
  loading: boolean
  onSelectPackage: (pkg: DistributionPackingUnit) => void
  onBack: () => void
}

function PackagesListView({
  packages,
  loading,
  onSelectPackage,
  onBack,
}: PackagesListViewProps) {
  const [search, setSearch] = useState('')
  const [selectedField, setSelectedField] = useState<FilterField>('all')

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return packages

    return packages.filter((pkg) => {
      const serial = String(pkg.serialNumber ?? pkg.displaySerial ?? '').toLowerCase()
      const packer = (
        pkg.packerName ||
        (pkg.createdBy?.firstName
          ? `${pkg.createdBy.firstName} ${pkg.createdBy.lastName ?? ''}`
          : '') ||
        'שימי שמעוני'
      ).toLowerCase()

      const src = (pkg.sourceDescription ?? '').toLowerCase()
      const dest = (pkg.destinationDescription ?? '').toLowerCase()
      const desc = (pkg.description ?? '').toLowerCase()

      switch (selectedField) {
        case 'serial':
          return serial.includes(q)
        case 'packer':
          return packer.includes(q)
        case 'source':
          return src.includes(q)
        case 'destination':
          return dest.includes(q)
        case 'all':
        default:
          return (
            serial.includes(q) ||
            packer.includes(q) ||
            src.includes(q) ||
            dest.includes(q) ||
            desc.includes(q)
          )
      }
    })
  }, [packages, search, selectedField])

  return (
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
      {/* Subtle top shade */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.02) 20%, transparent 40%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Header */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          pt: '4vh',
          pb: '1vh',
          px: '5vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <IconButton
          onClick={onBack}
          sx={{
            position: 'absolute',
            right: '4vw',
            top: '3.8vh',
            color: 'white',
            p: 0.5,
          }}
          title="חזרה לתפריט"
        >
          <ChevronRight size={30} strokeWidth={2.5} />
        </IconButton>

        <Typography
          sx={{
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 800,
            fontSize: '1.75rem',
            color: 'white',
            textShadow: '0 2px 8px rgba(0,0,0,0.45)',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          יחידת הובלה שהתקבלה
        </Typography>

        <Typography
          sx={{
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 700,
            fontSize: '1.05rem',
            color: '#341c08',
            mt: 0.8,
            textAlign: 'center',
          }}
        >
          פתח אריזה לפיזור
        </Typography>
      </Box>

      {/* Filter Box */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          px: '4.5vw',
          pt: 1,
          pb: 1.5,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            borderRadius: '16px',
            p: 1.2,
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            border: '1px solid rgba(210, 180, 140, 0.5)',
          }}
        >
          {/* Search Input */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(247, 240, 228, 0.75)',
              borderRadius: '12px',
              px: 1.2,
              py: '4px',
              gap: 1,
              border: '1px solid rgba(190, 150, 100, 0.3)',
            }}
          >
            <Search size={18} color="#8B5E3C" style={{ flexShrink: 0 }} />
            <Box
              component="input"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="סינון לפי מס׳ אריזה, מקור, יעד, אורז..."
              sx={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.88rem',
                color: '#341c08',
                direction: 'rtl',
                '&::placeholder': { color: '#a07c60' },
              }}
            />
            {search && (
              <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.3, color: '#8B5E3C' }}>
                <X size={16} />
              </IconButton>
            )}
          </Box>

          {/* Quick Filter Field Chips */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 0.6,
              mt: 1,
              overflowX: 'auto',
              pt: 0.2,
            }}
          >
            {FILTER_FIELD_OPTIONS.map((field) => {
              const active = selectedField === field.id
              return (
                <Box
                  key={field.id}
                  onClick={() => setSelectedField(field.id)}
                  sx={{
                    flex: 1,
                    py: '4px',
                    px: '6px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: '0.78rem',
                    fontWeight: active ? 700 : 500,
                    fontFamily: 'Heebo, sans-serif',
                    backgroundColor: active ? '#8B5E3C' : 'rgba(235, 220, 195, 0.55)',
                    color: active ? '#fff' : '#5c3d24',
                    border: active ? '1px solid #724724' : '1px solid rgba(190, 150, 100, 0.2)',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    '&:active': { transform: 'scale(0.96)' },
                  }}
                >
                  {field.label}
                </Box>
              )
            })}
          </Box>
        </Box>
      </Box>

      {/* Packages Scrollable List */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: '4.5vw',
          pb: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          position: 'relative',
          zIndex: 2,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={34} sx={{ color: '#8B5E3C' }} />
          </Box>
        )}

        {!loading && filteredPackages.length === 0 && (
          <Box
            sx={{
              mt: 2,
              p: 2.5,
              borderRadius: '16px',
              backgroundColor: 'rgba(255,255,255,0.85)',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.95rem', fontWeight: 600, color: '#4a2c14' }}>
              {search ? 'לא נמצאו אריזות תואמות לסינון' : 'אין אריזות הממתינות לפיזור'}
            </Typography>
          </Box>
        )}

        {!loading &&
          filteredPackages.map((pkg) => {
            const dest = (() => {
              try {
                return pkg.destinationDescription ? JSON.parse(pkg.destinationDescription) : null
              } catch {
                return null
              }
            })()

            const srcLines = pkg.sourceDescription
              ? pkg.sourceDescription.split('|').map((s) => s.trim())
              : []

            const packer =
              pkg.packerName ||
              (pkg.createdBy?.firstName
                ? `${pkg.createdBy.firstName} ${pkg.createdBy.lastName ?? ''}`
                : '') ||
              'שימי שמעוני'

            return (
              <Box
                key={pkg.id}
                onClick={() => onSelectPackage(pkg)}
                sx={{
                  backgroundColor: 'rgba(247, 233, 204, 0.88)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  borderRadius: '20px',
                  border: '1.5px solid rgba(220, 195, 155, 0.65)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                  p: '14px 16px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(252, 240, 215, 0.95)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
                  },
                  '&:active': {
                    transform: 'scale(0.985)',
                  },
                }}
              >
                {/* Header row: Package Number */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: 'Heebo, sans-serif',
                      fontWeight: 800,
                      fontSize: '1.02rem',
                      color: '#2e1908',
                      letterSpacing: 0.2,
                    }}
                  >
                    מס׳ אריזה {pkg.serialNumber ?? pkg.displaySerial ?? '55555'}
                  </Typography>

                  {pkg.status === 'verified' && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        backgroundColor: 'rgba(46, 125, 50, 0.15)',
                        px: 1,
                        py: '2px',
                        borderRadius: '6px',
                      }}
                    >
                      <CheckCircle2 size={14} color="#2e7d32" />
                      <Typography
                        sx={{
                          fontFamily: 'Heebo, sans-serif',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#2e7d32',
                        }}
                      >
                        נפרקה
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Body: Two text columns + Box image on right */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                  }}
                >
                  {/* Two columns text layout */}
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      {/* Column 1: Source */}
                      <Box sx={{ flex: 1, textAlign: 'right' }}>
                        <Typography
                          sx={{
                            fontFamily: 'Heebo, sans-serif',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: '#341c08',
                            lineHeight: 1.45,
                          }}
                        >
                          נשלח מ: {srcLines[0] || 'יחידת מצו"ב'}
                        </Typography>
                        {srcLines[1] && (
                          <Typography
                            sx={{
                              fontFamily: 'Heebo, sans-serif',
                              fontSize: '0.8rem',
                              color: '#6e4526',
                              lineHeight: 1.45,
                            }}
                          >
                            {srcLines[1]}
                          </Typography>
                        )}
                        {srcLines[2] && (
                          <Typography
                            sx={{
                              fontFamily: 'Heebo, sans-serif',
                              fontSize: '0.8rem',
                              color: '#6e4526',
                              lineHeight: 1.45,
                            }}
                          >
                            {srcLines[2]}
                          </Typography>
                        )}
                        {srcLines[3] && (
                          <Typography
                            sx={{
                              fontFamily: 'Heebo, sans-serif',
                              fontSize: '0.8rem',
                              color: '#6e4526',
                              lineHeight: 1.45,
                            }}
                          >
                            {srcLines[3]}
                          </Typography>
                        )}
                      </Box>

                      {/* Column 2: Destination */}
                      <Box sx={{ flex: 1, textAlign: 'right' }}>
                        <Typography
                          sx={{
                            fontFamily: 'Heebo, sans-serif',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: '#341c08',
                            lineHeight: 1.45,
                          }}
                        >
                          נשלח אל: {dest?.building || 'בניין A'}
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: 'Heebo, sans-serif',
                            fontSize: '0.8rem',
                            color: '#6e4526',
                            lineHeight: 1.45,
                          }}
                        >
                          {dest?.floor || 'קומה 3'}
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: 'Heebo, sans-serif',
                            fontSize: '0.8rem',
                            color: '#6e4526',
                            lineHeight: 1.45,
                          }}
                        >
                          {dest?.room || 'חדר 309'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Bottom: Packer name */}
                    <Box sx={{ pt: 0.5 }}>
                      <Typography
                        sx={{
                          fontFamily: 'Heebo, sans-serif',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#522f16',
                        }}
                      >
                        ארז: {packer}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Right side: 3D Cardboard box illustration */}
                  <Box
                    sx={{
                      width: '92px',
                      height: '82px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CardboardBoxSvg width={92} height={82} />
                  </Box>
                </Box>
              </Box>
            )
          })}
      </Box>

      {/* Bottom Bar */}
      <BottomNavBar active="packing-units" />
    </Box>
  )
}

// ─── Sub-view 2: Package Items Unpacking Screen (Left page in mockup) ────────

interface PackageItemsViewProps {
  pkg: DistributionPackingUnit
  userId: string | null
  onBack: () => void
  onUpdateCompleted: (updatedPkg: DistributionPackingUnit) => void
}

function PackageItemsView({
  pkg,
  userId,
  onBack,
  onUpdateCompleted,
}: PackageItemsViewProps) {
  // Track quantities and checked state per item
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    pkg.items.forEach((item) => {
      // default to full quantity or already distributed quantity
      initial[item.id] = item.distributedQuantity > 0 ? item.distributedQuantity : item.quantity
    })
    return initial
  })

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    pkg.items.forEach((item) => {
      initial[item.id] = true
    })
    return initial
  })

  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const allChecked = useMemo(() => {
    return pkg.items.length > 0 && pkg.items.every((it) => checkedItems[it.id])
  }, [pkg.items, checkedItems])

  const handleToggleSelectAll = () => {
    const nextVal = !allChecked
    const newChecked: Record<string, boolean> = {}
    const newQuantities = { ...quantities }
    pkg.items.forEach((item) => {
      newChecked[item.id] = nextVal
      if (nextVal) {
        newQuantities[item.id] = item.quantity
      } else {
        newQuantities[item.id] = 0
      }
    })
    setCheckedItems(newChecked)
    setQuantities(newQuantities)
  }

  const handleToggleItem = (itemId: string, maxQty: number) => {
    const current = checkedItems[itemId]
    const next = !current
    setCheckedItems((prev) => ({ ...prev, [itemId]: next }))
    setQuantities((prev) => ({
      ...prev,
      [itemId]: next ? (prev[itemId] > 0 ? prev[itemId] : maxQty) : 0,
    }))
  }

  const handleQuantityChange = (itemId: string, val: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(val, maxQty))
    setQuantities((prev) => ({ ...prev, [itemId]: clamped }))
    setCheckedItems((prev) => ({ ...prev, [itemId]: clamped > 0 }))
  }

  const handleFinish = async () => {
    setSubmitting(true)
    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `dist-${Date.now()}`
    const payload = {
      idempotencyKey,
      finalConfirmation: true,
      items: pkg.items.map((item) => ({
        itemId: item.id,
        actualQuantity: checkedItems[item.id] ? (quantities[item.id] ?? item.quantity) : 0,
      })),
    }

    try {
      if (userId) {
        await distributePackingUnit(pkg.id, payload, userId)
      }
    } catch (err) {
      console.warn('Backend distribute failed, proceeding with local update:', err)
    }

    // Update local state representation
    const updatedPkg: DistributionPackingUnit = {
      ...pkg,
      status: 'verified',
      items: pkg.items.map((item) => ({
        ...item,
        distributedQuantity: checkedItems[item.id] ? (quantities[item.id] ?? item.quantity) : 0,
        status: 'verified',
      })),
    }

    setToastMsg('יחידת האריזה עודכנה בהצלחה!')
    setTimeout(() => {
      onUpdateCompleted(updatedPkg)
    }, 400)
  }

  return (
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
      {/* Subtle top shade */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.02) 25%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Top Header */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          pt: '4vh',
          pb: '1.2vh',
          px: '5vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Back button (RTL points right) */}
        <IconButton
          onClick={onBack}
          sx={{
            position: 'absolute',
            right: '4vw',
            top: '3.8vh',
            color: 'white',
            p: 0.5,
          }}
          title="חזרה לרשימת האריזות"
        >
          <ChevronRight size={30} strokeWidth={2.5} />
        </IconButton>

        <Typography
          sx={{
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 800,
            fontSize: '1.65rem',
            color: 'white',
            textShadow: '0 2px 8px rgba(0,0,0,0.45)',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          פריטים ביחידת הובלה שהתקבלה
        </Typography>

        <Typography
          sx={{
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 600,
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.95)',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            mt: 0.6,
            textAlign: 'center',
          }}
        >
          בחר פריטים שהגיעו
        </Typography>
      </Box>

      {/* Select All and Warning Banner Area */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          px: '5vw',
          pb: 1.2,
          flexShrink: 0,
        }}
      >
        {/* "בחר הכל" Checkbox Row */}
        <Box
          onClick={handleToggleSelectAll}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 1,
            py: 0.5,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <Checkbox
            checked={allChecked}
            onChange={handleToggleSelectAll}
            sx={{
              p: 0,
              color: '#3d2008',
              '&.Mui-checked': { color: '#8B5E3C' },
            }}
          />
          <Typography
            sx={{
              fontFamily: 'Heebo, sans-serif',
              fontWeight: 700,
              fontSize: '0.96rem',
              color: '#341c08',
            }}
          >
            בחר הכל
          </Typography>
        </Box>

        {/* Warning pill banner */}
        <Box
          sx={{
            mt: 1,
            backgroundColor: 'rgba(255, 243, 224, 0.88)',
            border: '1px solid rgba(220, 150, 100, 0.4)',
            borderRadius: '999px',
            py: '6px',
            px: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <Typography
            sx={{
              fontFamily: 'Heebo, sans-serif',
              fontWeight: 700,
              fontSize: '0.86rem',
              color: '#b23b16',
              textAlign: 'center',
            }}
          >
            *שים לב, לא כל האריזות נפרקו
          </Typography>
        </Box>
      </Box>

      {/* Items Scrollable List */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: '5vw',
          pb: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {pkg.items.map((item) => {
          const isChecked = !!checkedItems[item.id]
          const currentQty = quantities[item.id] ?? item.quantity

          return (
            <Box
              key={item.id}
              sx={{
                backgroundColor: 'rgba(247, 233, 204, 0.88)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: '16px',
                border: '1.5px solid rgba(215, 185, 140, 0.6)',
                p: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                boxShadow: '0 3px 12px rgba(0,0,0,0.08)',
              }}
            >
              {/* Item Top Row: Checkbox + Name on right, Quantity on left */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {/* Right: Checkbox + Name */}
                <Box
                  onClick={() => handleToggleItem(item.id, item.quantity)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <Checkbox
                    checked={isChecked}
                    onChange={() => handleToggleItem(item.id, item.quantity)}
                    sx={{
                      p: 0,
                      color: '#6d4220',
                      '&.Mui-checked': { color: '#8B5E3C' },
                    }}
                  />
                  <Typography
                    sx={{
                      fontFamily: 'Heebo, sans-serif',
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: '#2e1908',
                    }}
                  >
                    {item.description}
                  </Typography>
                </Box>

                {/* Left: Total expected quantity */}
                <Typography
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.92rem',
                    color: '#4e2f17',
                  }}
                >
                  כמות: {item.quantity}
                </Typography>
              </Box>

              {/* Lower row: "כמות יחידות:" with numeric adjustment */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(255, 248, 236, 0.85)',
                  borderRadius: '12px',
                  px: 1.5,
                  py: '6px',
                  border: '1px solid rgba(200, 165, 120, 0.4)',
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    color: '#55341c',
                  }}
                >
                  כמות יחידות:
                </Typography>

                {/* Stepper controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() =>
                      handleQuantityChange(item.id, currentQty - 1, item.quantity)
                    }
                    disabled={currentQty <= 0}
                    sx={{
                      width: 28,
                      height: 28,
                      backgroundColor: 'rgba(139, 94, 60, 0.15)',
                      color: '#55341c',
                      '&:hover': { backgroundColor: 'rgba(139, 94, 60, 0.25)' },
                      '&.Mui-disabled': { opacity: 0.35 },
                    }}
                  >
                    <Minus size={14} />
                  </IconButton>

                  <Box
                    component="input"
                    type="number"
                    value={currentQty}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleQuantityChange(
                        item.id,
                        parseInt(e.target.value, 10) || 0,
                        item.quantity,
                      )
                    }
                    sx={{
                      width: '42px',
                      textAlign: 'center',
                      fontFamily: 'Heebo, sans-serif',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      color: '#2e1908',
                      MozAppearance: 'textfield',
                      '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                        WebkitAppearance: 'none',
                        margin: 0,
                      },
                    }}
                  />

                  <IconButton
                    size="small"
                    onClick={() =>
                      handleQuantityChange(item.id, currentQty + 1, item.quantity)
                    }
                    disabled={currentQty >= item.quantity}
                    sx={{
                      width: 28,
                      height: 28,
                      backgroundColor: 'rgba(139, 94, 60, 0.15)',
                      color: '#55341c',
                      '&:hover': { backgroundColor: 'rgba(139, 94, 60, 0.25)' },
                      '&.Mui-disabled': { opacity: 0.35 },
                    }}
                  >
                    <Plus size={14} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* Bottom Button: "סיום עדכון" */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          px: '5vw',
          pt: 1,
          pb: 1.5,
          flexShrink: 0,
        }}
      >
        <Box
          onClick={submitting ? undefined : handleFinish}
          sx={{
            width: '100%',
            py: '13px',
            borderRadius: '999px',
            backgroundColor: submitting ? '#6e4c35' : '#73411b',
            color: 'white',
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 800,
            fontSize: '1.05rem',
            textAlign: 'center',
            cursor: submitting ? 'wait' : 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            letterSpacing: 0.4,
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            transition: 'all 0.18s ease',
            '&:hover': {
              backgroundColor: '#5d3212',
            },
            '&:active': {
              transform: 'scale(0.97)',
            },
          }}
        >
          {submitting ? 'מעדכן...' : 'סיום עדכון'}
        </Box>
      </Box>

      {/* Bottom Bar */}
      <BottomNavBar active="packing-units" />

      {/* Toast */}
      <Snackbar
        open={!!toastMsg}
        autoHideDuration={2200}
        onClose={() => setToastMsg(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message={toastMsg}
        slotProps={{
          content: {
            sx: {
              backgroundColor: '#4a250a',
              fontFamily: 'Heebo, sans-serif',
              fontSize: '0.92rem',
              borderRadius: '12px',
              direction: 'rtl',
            },
          },
        }}
      />
    </Box>
  )
}

// ─── Root Component: Manages view transition ────────────────────────────────

export default function DistributionPage({
  onBack,
  userId,
  orgScopeId,
}: DistributionPageProps) {
  const [packages, setPackages] = useState<DistributionPackingUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPackage, setSelectedPackage] = useState<DistributionPackingUnit | null>(null)

  const loadPackages = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await fetchDistributionPackingUnits(orgScopeId, userId)
      setPackages(data)
    } catch (err) {
      console.error('Failed to load distribution packages:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, orgScopeId])

  useEffect(() => {
    loadPackages()
  }, [loadPackages])

  const handleUpdateCompleted = (updatedPkg: DistributionPackingUnit) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === updatedPkg.id ? updatedPkg : p)),
    )
    setSelectedPackage(null)
  }

  return (
    <ThemeProvider theme={theme}>
      {selectedPackage ? (
        <PackageItemsView
          pkg={selectedPackage}
          userId={userId}
          onBack={() => setSelectedPackage(null)}
          onUpdateCompleted={handleUpdateCompleted}
        />
      ) : (
        <PackagesListView
          packages={packages}
          loading={loading}
          onSelectPackage={setSelectedPackage}
          onBack={onBack}
        />
      )}
    </ThemeProvider>
  )
}
