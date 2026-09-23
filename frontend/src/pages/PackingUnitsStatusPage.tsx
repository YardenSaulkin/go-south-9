import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import { fetchPackingUnitsStatus, type StatusPackingUnit, type PackingUnitsStatus } from '../lib/api'
import { useCurrentUser } from '../auth/useCurrentUser'
import BottomNavBar from '../components/BottomNavBar'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

const STATUS_LABEL: Record<string, string> = {
  not_sent: 'טרם נשלח',
  assigned_to_shipment: 'שויך להובלה',
  in_transit: 'בדרך',
  arrived_pending_verification: 'ממתין לאישור',
  verified: 'מאומת',
}

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'info' | 'error'> = {
  not_sent: 'default',
  assigned_to_shipment: 'default',
  in_transit: 'info',
  arrived_pending_verification: 'warning',
  verified: 'success',
}

const PU_TYPE_LABEL: Record<string, string> = {
  personal_carton: 'קרטון אישי',
  professional_carton: 'קרטון מקצועי',
  pallet: 'פלט',
  dolav: 'זולב',
  bulk: 'גוש',
}

interface Props {
  userId: string | null
}

function PackingUnitCard({ pu }: { pu: StatusPackingUnit }) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        p: 1.5,
        mb: 1,
        border: '1px solid rgba(139,94,60,0.15)',
        bgcolor: '#fff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Chip
          label={STATUS_LABEL[pu.status] ?? pu.status}
          color={STATUS_COLOR[pu.status] ?? 'default'}
          size="small"
          sx={{ fontFamily: 'Heebo, sans-serif' }}
        />
        <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.78rem', color: '#888' }}>
          #{pu.displaySerial}
        </Typography>
      </Box>
      <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 600, color: '#2d1b0a' }}>
        {pu.description}
      </Typography>
      {pu.packingUnitType && (
        <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.8rem', color: '#8B5E3C', mt: 0.25 }}>
          {PU_TYPE_LABEL[pu.packingUnitType] ?? pu.packingUnitType}
        </Typography>
      )}
    </Paper>
  )
}

export default function PackingUnitsStatusPage({ userId }: Props) {
  const currentUser = useCurrentUser()
  const isAdmin = currentUser?.role === 'admin'
  const [data, setData] = useState<PackingUnitsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetchPackingUnitsStatus(userId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה בטעינת הנתונים'))
      .finally(() => setLoading(false))
  }, [userId])

  const renderContent = () => {
    if (!data) return null
    const { packingUnits, unitNames } = data

    if (packingUnits.length === 0) {
      return (
        <Typography sx={{ fontFamily: 'Heebo, sans-serif', color: 'text.secondary', mt: 4, textAlign: 'center' }}>
          אין יחידות אריזה להצגה
        </Typography>
      )
    }

    if (isAdmin && unitNames !== undefined) {
      const grouped = new Map<string, StatusPackingUnit[]>()
      for (const pu of packingUnits) {
        const code = pu.orgScope?.orgCode?.substring(0, 2) ?? 'unknown'
        if (!grouped.has(code)) grouped.set(code, [])
        grouped.get(code)!.push(pu)
      }
      return Array.from(grouped.entries()).map(([code, units]) => (
        <Box key={code} sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a' }}>
              יחידה {code}
            </Typography>
            <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.85rem', color: '#8B5E3C' }}>
              כמות: {units.length}
            </Typography>
          </Box>
          <Divider sx={{ mb: 1.5, borderColor: 'rgba(139,94,60,0.3)' }} />
          {units.map((pu) => <PackingUnitCard key={pu.id} pu={pu} />)}
        </Box>
      ))
    }

    return packingUnits.map((pu) => <PackingUnitCard key={pu.id} pu={pu} />)
  }

  return (
    <ThemeProvider theme={theme}>
      <Box
        dir="rtl"
        sx={{ height: 'calc(100dvh - 62px)', bgcolor: '#f5f0eb', display: 'flex', flexDirection: 'column' }}
      >
        <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
          <Typography
            variant="h5"
            sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a', mb: 3 }}
          >
            סטטוס אריזות
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, fontFamily: 'Heebo, sans-serif' }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            renderContent()
          )}
        </Box>

        <BottomNavBar active="packing-units" />
      </Box>
    </ThemeProvider>
  )
}
