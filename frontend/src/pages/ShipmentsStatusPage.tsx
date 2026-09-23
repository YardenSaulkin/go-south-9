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
  Divider,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import { ChevronDown, CheckCircle, Clock } from 'lucide-react'
import { fetchShipmentsStatus, confirmShipmentArrival, type PocDashboard, type PocShipment } from '../lib/api'
import { useCurrentUser } from '../auth/useCurrentUser'
import BottomNavBar from '../components/BottomNavBar'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

const STATUS_LABEL: Record<string, string> = {
  not_sent: 'טרם נשלח',
  sent: 'בדרך',
  arrived: 'ממתין לאישור',
  verified: 'מאומת',
  assigned_to_shipment: 'שויך להובלה',
  in_transit: 'בדרך',
  arrived_pending_verification: 'ממתין לאישור',
}

const EXPECTED_PU_STATUS: Record<string, string> = {
  not_sent: 'not_sent',
  sent: 'in_transit',
  arrived: 'arrived_pending_verification',
  verified: 'verified',
}

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'info'> = {
  not_sent: 'default',
  sent: 'info',
  arrived: 'warning',
  verified: 'success',
  assigned_to_shipment: 'default',
  in_transit: 'info',
  arrived_pending_verification: 'warning',
}

interface Props {
  userId: string | null
}

function ShipmentCard({
  shipment,
  onConfirmArrival,
  confirming,
  unitCode,
}: {
  shipment: PocShipment
  onConfirmArrival?: () => void
  confirming: boolean
  unitCode?: string
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
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', pr: 1, pl: 1, gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Chip
              label={STATUS_LABEL[shipment.status] ?? shipment.status}
              color={STATUS_COLOR[shipment.status] ?? 'default'}
              size="small"
              sx={{ fontFamily: 'Heebo, sans-serif' }}
            />
            {shipment.status === 'verified' && <CheckCircle size={16} color="#4caf50" />}
          </Box>
          <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>
            {shipment.description}
          </Typography>
          {unitCode && (
            <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.78rem', color: '#8B5E3C' }}>
              יחידה {unitCode}
            </Typography>
          )}
          {shipment.status === 'sent' && onConfirmArrival && (
            <Button
              fullWidth
              size="small"
              variant="contained"
              disabled={confirming}
              onClick={(e) => { e.stopPropagation(); onConfirmArrival() }}
              sx={{
                fontFamily: 'Heebo, sans-serif',
                bgcolor: '#8B5E3C',
                '&:hover': { bgcolor: '#7a5232' },
                mt: 0.25,
              }}
            >
              {confirming ? <CircularProgress size={16} color="inherit" /> : 'אשר הגעה'}
            </Button>
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
            <Box key={pu.id} sx={{ mb: 0.75, p: 1, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.06)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {pu.status !== EXPECTED_PU_STATUS[shipment.status] && (
                  <Chip
                    label={STATUS_LABEL[pu.status] ?? pu.status}
                    color="error"
                    size="small"
                    sx={{ fontFamily: 'Heebo, sans-serif' }}
                  />
                )}
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

export default function ShipmentsStatusPage({ userId }: Props) {
  const currentUser = useCurrentUser()
  const [dashboard, setDashboard] = useState<PocDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const isPoc = currentUser?.role === 'poc'
  const isAdmin = currentUser?.role === 'admin'

  const load = () => {
    if (!userId) return
    setLoading(true)
    fetchShipmentsStatus(userId)
      .then(setDashboard)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה בטעינת הנתונים'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [userId])

  const handleConfirmArrival = async (shipmentId: string) => {
    if (!userId) return
    setConfirming(shipmentId)
    try {
      await confirmShipmentArrival(shipmentId, userId)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה באישור הגעה')
    } finally {
      setConfirming(null)
    }
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
            סטטוס הובלות
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
          ) : dashboard ? (
            <Box>
              {/* Pending section — shipments in 'sent' status */}
              <Paper
                elevation={0}
                sx={{ borderRadius: 3, p: 2.5, mb: 3, border: '1px solid rgba(255,152,0,0.3)', bgcolor: 'rgba(255,152,0,0.05)' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Clock size={20} color="#f57c00" />
                  <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#f57c00' }}>
                    בדרך ({dashboard.pending.length})
                  </Typography>
                </Box>
                {dashboard.pending.length === 0 ? (
                  <Typography sx={{ fontFamily: 'Heebo, sans-serif', color: 'text.secondary' }}>
                    אין הובלות בדרך
                  </Typography>
                ) : (
                  dashboard.pending.map((s) => (
                    <ShipmentCard
                      key={s.id}
                      shipment={s}
                      onConfirmArrival={isPoc ? () => handleConfirmArrival(s.id) : undefined}
                      confirming={confirming === s.id}
                      unitCode={isAdmin ? (s.orgScope.orgCode?.substring(0, 2) ?? undefined) : undefined}
                    />
                  ))
                )}
              </Paper>

              {/* Rest of shipments */}
              {dashboard.unitNames ? (
                /* Admin view — grouped by unit */
                (() => {
                  const unitNames = dashboard.unitNames!
                  const grouped = new Map<string, PocShipment[]>()
                  for (const s of dashboard.shipments) {
                    const code = s.orgScope.orgCode?.substring(0, 2) ?? 'unknown'
                    if (!grouped.has(code)) grouped.set(code, [])
                    grouped.get(code)!.push(s)
                  }
                  return Array.from(grouped.entries()).flatMap(([code, ships]) => {
                    const nonPending = ships.filter((s) => s.status !== 'sent')
                    if (nonPending.length === 0) return []
                    return [(
                      <Box key={code} sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a' }}>
                            יחידה {unitNames[code] ?? code}
                          </Typography>
                          <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.85rem', color: '#8B5E3C' }}>
                            כמות: {nonPending.length}
                          </Typography>
                        </Box>
                        <Divider sx={{ mb: 1.5, borderColor: 'rgba(139,94,60,0.3)' }} />
                        {nonPending.map((s) => (
                          <ShipmentCard
                            key={s.id}
                            shipment={s}
                            confirming={confirming === s.id}
                          />
                        ))}
                      </Box>
                    )]
                  })
                })()
              ) : (
                /* Normal / POC flat list */
                <>
                  {dashboard.shipments.filter((s) => s.status !== 'sent').length > 0 && (
                    <>
                      <Typography
                        sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a', mb: 1.5 }}
                      >
                        כל ההובלות ({dashboard.shipments.filter((s) => s.status !== 'sent').length})
                      </Typography>
                      {dashboard.shipments
                        .filter((s) => s.status !== 'sent')
                        .map((s) => (
                          <ShipmentCard
                            key={s.id}
                            shipment={s}
                            confirming={confirming === s.id}
                          />
                        ))}
                    </>
                  )}
                </>
              )}
            </Box>
          ) : null}
        </Box>

        <BottomNavBar active="shipments" />
      </Box>
    </ThemeProvider>
  )
}
