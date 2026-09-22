import { Box, Typography, Dialog } from '@mui/material'

export interface ShipmentSummaryProps {
  open: boolean
  shipmentNumber?: string
  licensePlate?: string
  unitCount?: number | string
  dateTime?: Date
  onContinue: () => void
  onExit: () => void
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ShipmentSummaryModal({
  open,
  shipmentNumber = '56789',
  licensePlate = '22233344',
  unitCount,
  dateTime = new Date(),
  onContinue,
  onExit,
}: ShipmentSummaryProps) {
  const dividerSx = {
    height: '1px',
    backgroundColor: 'rgba(180, 140, 100, 0.35)',
    my: 1.2,
  }

  const innerCardSx = {
    backgroundColor: '#faf5ea',
    borderRadius: '16px',
    p: '14px 18px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(220, 200, 175, 0.5)',
  }

  // If licensePlate has dashes, also show cleanly
  const cleanPlate = licensePlate ? licensePlate.replace(/-/g, '') : '22233344'

  return (
    <Dialog
      open={open}
      onClose={onExit}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
          },
        },
        paper: {
          sx: {
            borderRadius: '24px',
            backgroundColor: '#f5e7ce',
            border: '1.5px solid rgba(220, 190, 150, 0.6)',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.35)',
            width: '100%',
            maxWidth: '380px',
            mx: 2.5,
            p: 2.5,
            direction: 'rtl',
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {/* Title */}
        <Typography
          sx={{
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 800,
            fontSize: '1.35rem',
            color: '#44220b',
            textAlign: 'center',
            mb: 2,
            letterSpacing: 0.3,
          }}
        >
          יחידת הובלה הועמסה!
        </Typography>

        {/* Card 1: Shipment details */}
        <Box sx={innerCardSx}>
          {/* Row 1: Shipment Number */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.92rem',
                color: '#7a5135',
                fontWeight: 500,
              }}
            >
              מס' הובלה
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#4a2b13',
              }}
            >
              {shipmentNumber}
            </Typography>
          </Box>

          <Box sx={dividerSx} />

          {/* Row 2: License Plate */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.92rem',
                color: '#7a5135',
                fontWeight: 500,
              }}
            >
              מס' רישוי
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#4a2b13',
                letterSpacing: 0.5,
              }}
            >
              {cleanPlate}
            </Typography>
          </Box>

          <Box sx={dividerSx} />

          {/* Row 3: Packing units count */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.92rem',
                color: '#7a5135',
                fontWeight: 500,
              }}
            >
              כמות יחידות אריזה
            </Typography>
            {unitCount !== undefined && (
              <Typography
                sx={{
                  fontFamily: 'Heebo, sans-serif',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#4a2b13',
                }}
              >
                {unitCount}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Card 2: Date and Time */}
        <Box
          sx={{
            ...innerCardSx,
            mt: 1.5,
            p: '10px 14px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {/* Date */}
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.85rem',
                color: '#7a5135',
                fontWeight: 500,
                mb: 0.3,
              }}
            >
              תאריך:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.88rem',
                color: '#4a2b13',
                fontWeight: 600,
              }}
            >
              {formatDate(dateTime)}
            </Typography>
          </Box>

          {/* Vertical divider */}
          <Box
            sx={{
              width: '1px',
              backgroundColor: 'rgba(180, 140, 100, 0.35)',
              alignSelf: 'stretch',
              my: 0.5,
            }}
          />

          {/* Time */}
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.85rem',
                color: '#7a5135',
                fontWeight: 500,
                mb: 0.3,
              }}
            >
              שעה:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.88rem',
                color: '#4a2b13',
                fontWeight: 600,
              }}
            >
              {formatTime(dateTime)}
            </Typography>
          </Box>
        </Box>

        {/* Card 3: Continue loading question card */}
        <Box sx={{ ...innerCardSx, mt: 1.8, p: '14px 16px' }}>
          <Typography
            sx={{
              fontFamily: 'Heebo, sans-serif',
              fontWeight: 700,
              fontSize: '0.95rem',
              color: '#4a2b13',
              textAlign: 'center',
              mb: 1.5,
            }}
          >
            האם להמשיך בהעמסה?
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            {/* Yes button */}
            <Box
              onClick={onContinue}
              sx={{
                flex: 1,
                py: '9px',
                borderRadius: '12px',
                backgroundColor: '#6e3519',
                color: '#ffffff',
                fontFamily: 'Heebo, sans-serif',
                fontWeight: 700,
                fontSize: '0.95rem',
                textAlign: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                transition: 'all 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
                '&:hover': {
                  backgroundColor: '#5d2c13',
                },
                '&:active': {
                  transform: 'scale(0.97)',
                },
              }}
            >
              כן
            </Box>

            {/* No button */}
            <Box
              onClick={onExit}
              sx={{
                flex: 1,
                py: '9px',
                borderRadius: '12px',
                backgroundColor: '#dfcdb6',
                border: '1.5px solid #8B5E3C',
                color: '#4a2b13',
                fontFamily: 'Heebo, sans-serif',
                fontWeight: 700,
                fontSize: '0.95rem',
                textAlign: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                transition: 'all 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
                '&:hover': {
                  backgroundColor: '#d3c0a7',
                },
                '&:active': {
                  transform: 'scale(0.97)',
                },
              }}
            >
              לא
            </Box>
          </Box>
        </Box>
      </Box>
    </Dialog>
  )
}
