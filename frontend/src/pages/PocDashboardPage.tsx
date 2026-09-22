import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import { ArrowRight, ChevronDown, CheckCircle, Clock } from 'lucide-react'
import { navigate } from '../navigation'
import { fetchPocDashboard, verifyShipment, type PocDashboard, type PocShipment } from '../lib/api'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

const STATUS_LABEL: Record<string, string> = {
  not_sent: 'טרם נשלח',
  sent: 'בדרך',
  arrived: 'הגיע — ממתין לאימות',
  verified: 'מאומת',
}

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'info'> = {
  not_sent: 'default',
  sent: 'info',
  arrived: 'warning',
  verified: 'success',
}

interface Props {
  userId: string | null
}

function ShipmentCard({
  shipment,
  onVerify,
  verifying,
}: {
  shipment: PocShipment
  onVerify?: () => void
  verifying: boolean
}) {
  return (
    <Accordion
      elevation={0}
      sx={{
        borderRadius: '12px !important',
        border: '1px solid rgba(139,94,60,0.2)',
        mb: 1,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ChevronDown size={18} />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', pr: 1 }}>
          <Chip
            label={STATUS_LABEL[shipment.status] ?? shipment.status}
            color={STATUS_COLOR[shipment.status] ?? 'default'}
            size="small"
            sx={{ fontFamily: 'Heebo, sans-serif' }}
          />
          <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 600, flexGrow: 1 }}>
            {shipment.description}
          </Typography>
          {shipment.status === 'arrived' && onVerify && (
            <Button
              size="small"
              variant="contained"
              disabled={verifying}
              onClick={(e) => { e.stopPropagation(); onVerify() }}
              sx={{
                fontFamily: 'Heebo, sans-serif',
                bgcolor: '#8B5E3C',
                '&:hover': { bgcolor: '#7a5232' },
                flexShrink: 0,
              }}
            >
              {verifying ? <CircularProgress size={16} color="inherit" /> : 'אשר קבלה'}
            </Button>
          )}
          {shipment.status === 'verified' && (
            <CheckCircle size={18} color="#4caf50" />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {shipment.packingUnits.length === 0 ? (
          <Typography sx={{ fontFamily: 'Heebo, sans-serif', color: 'text.secondary' }}>
            אין יחידות אריזה
          </Typography>
        ) : (
          shipment.packingUnits.map((pu) => (
            <Box key={pu.id} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={STATUS_LABEL[pu.status] ?? pu.status}
                  color={STATUS_COLOR[pu.status] ?? 'default'}
                  size="small"
                  sx={{ fontFamily: 'Heebo, sans-serif' }}
                />
                <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>
                  {pu.description} {pu.serialNumber != null ? `(#${pu.serialNumber})` : ''}
                </Typography>
              </Box>
              {pu.items.length > 0 && (
                <Box component="ul" sx={{ mt: 0.5, mb: 0, pr: 3 }}>
                  {pu.items.map((item) => (
                    <Typography
                      key={item.id}
                      component="li"
                      sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.85rem', color: 'text.secondary' }}
                    >
                      {item.description} × {item.quantity}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          ))
        )}
      </AccordionDetails>
    </Accordion>
  )
}

export default function PocDashboardPage({ userId }: Props) {
  const [dashboard, setDashboard] = useState<PocDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)

  const load = () => {
    if (!userId) return
    setLoading(true)
    fetchPocDashboard(userId)
      .then(setDashboard)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה בטעינת הדשבורד'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [userId])

  const handleVerify = async (shipmentId: string) => {
    if (!userId) return
    setVerifying(shipmentId)
    try {
      await verifyShipment(shipmentId, userId)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה באימות הובלה')
    } finally {
      setVerifying(null)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <Box dir="rtl" sx={{ minHeight: '100dvh', bgcolor: '#f5f0eb', p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton onClick={() => navigate('/menu')} size="small">
            <ArrowRight />
          </IconButton>
          <Typography
            variant="h5"
            sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a' }}
          >
            דשבורד קצין קישור
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontFamily: 'Heebo, sans-serif' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress />
          </Box>
        ) : dashboard ? (
          <Box>
            {/* Pending verification */}
            <Paper
              elevation={0}
              sx={{ borderRadius: 3, p: 2.5, mb: 3, border: '1px solid rgba(255,152,0,0.3)', bgcolor: 'rgba(255,152,0,0.05)' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Clock size={20} color="#f57c00" />
                <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#f57c00' }}>
                  ממתינות לאישור ({dashboard.pending.length})
                </Typography>
              </Box>
              {dashboard.pending.length === 0 ? (
                <Typography sx={{ fontFamily: 'Heebo, sans-serif', color: 'text.secondary' }}>
                  אין הובלות הממתינות לאישור
                </Typography>
              ) : (
                dashboard.pending.map((s) => (
                  <ShipmentCard
                    key={s.id}
                    shipment={s}
                    onVerify={() => handleVerify(s.id)}
                    verifying={verifying === s.id}
                  />
                ))
              )}
            </Paper>

            {/* All shipments */}
            <Typography
              sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a', mb: 1.5 }}
            >
              כל ההובלות ({dashboard.shipments.length})
            </Typography>
            {dashboard.shipments.map((s) => (
              <ShipmentCard
                key={s.id}
                shipment={s}
                onVerify={s.status === 'arrived' ? () => handleVerify(s.id) : undefined}
                verifying={verifying === s.id}
              />
            ))}
          </Box>
        ) : null}
      </Box>
    </ThemeProvider>
  )
}
