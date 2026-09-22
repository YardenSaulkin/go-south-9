import { Box, Typography, Dialog } from '@mui/material'

export interface PackingUnitSummaryProps {
  open: boolean
  serialNumber?: string
  source?: {
    unit?: string
    anaf?: string
    mador?: string
    room?: string
  }
  destination?: {
    building?: string
    floor?: string
    room?: string
  }
  madorSupervisor?: string
  roomSupervisor?: string
  packerName?: string
  onContinue: () => void
  onExit: () => void
}

export default function PackingUnitSummaryModal({
  open,
  serialNumber = '56789',
  source = {
    unit: 'יחידת מצו"ב',
    anaf: 'ענף חוכמה',
    mador: 'מדור מוח',
    room: 'חדר 208',
  },
  destination = {
    building: 'בניין A',
    floor: 'קומה 3',
    room: 'חדר 309',
  },
  madorSupervisor = 'שם אחראי',
  roomSupervisor = 'שם אחראי',
  packerName = 'שימי שמעוני 9223345',
  onContinue,
  onExit,
}: PackingUnitSummaryProps) {
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
          יחידת אריזה הושלמה!
        </Typography>

        {/* Card 1: Details */}
        <Box sx={innerCardSx}>
          {/* Top row: Packing Unit number */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.92rem',
                color: '#7a5135',
                fontWeight: 500,
              }}
            >
              מס' אריזה
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#4a2b13',
              }}
            >
              {serialNumber}
            </Typography>
          </Box>

          <Box sx={dividerSx} />

          {/* Middle section: Origin (נשלח מ) */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.9rem',
                color: '#7a5135',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                pt: 0.1,
              }}
            >
              נשלח מ:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
              {source.unit && (
                <Typography
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: '0.9rem',
                    color: '#4a2b13',
                    fontWeight: 500,
                  }}
                >
                  {source.unit}
                </Typography>
              )}
              {source.anaf && (
                <Typography
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: '0.9rem',
                    color: '#4a2b13',
                    fontWeight: 500,
                  }}
                >
                  {source.anaf}
                </Typography>
              )}
              {source.mador && (
                <Typography
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: '0.9rem',
                    color: '#4a2b13',
                    fontWeight: 500,
                  }}
                >
                  {source.mador}
                </Typography>
              )}
              {source.room && (
                <Typography
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: '0.9rem',
                    color: '#4a2b13',
                    fontWeight: 500,
                  }}
                >
                  {source.room}
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={dividerSx} />

          {/* Bottom section: Destination (נשלח אל) */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.9rem',
                color: '#7a5135',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                pt: 0.1,
              }}
            >
              נשלח אל:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
              {destination.building && (
                <Typography
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: '0.9rem',
                    color: '#4a2b13',
                    fontWeight: 500,
                  }}
                >
                  {destination.building}
                </Typography>
              )}
              {destination.floor && (
                <Typography
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: '0.9rem',
                    color: '#4a2b13',
                    fontWeight: 500,
                  }}
                >
                  {destination.floor}
                </Typography>
              )}
              {destination.room && (
                <Typography
                  sx={{
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: '0.9rem',
                    color: '#4a2b13',
                    fontWeight: 500,
                  }}
                >
                  {destination.room}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* Card 2: Supervisors */}
        <Box
          sx={{
            ...innerCardSx,
            mt: 1.5,
            p: '10px 14px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {/* Mador Supervisor */}
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
              אחראי מדור:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.88rem',
                color: '#4a2b13',
                fontWeight: 600,
              }}
            >
              {madorSupervisor}
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

          {/* Room Supervisor */}
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
              אחראי חדר:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Heebo, sans-serif',
                fontSize: '0.88rem',
                color: '#4a2b13',
                fontWeight: 600,
              }}
            >
              {roomSupervisor}
            </Typography>
          </Box>
        </Box>

        {/* Packer text line */}
        <Typography
          sx={{
            fontFamily: 'Heebo, sans-serif',
            fontSize: '0.9rem',
            color: '#4a2b13',
            textAlign: 'center',
            my: 1.5,
            fontWeight: 500,
          }}
        >
          אורז: {packerName}
        </Typography>

        {/* Card 3: Continue question card */}
        <Box sx={{ ...innerCardSx, p: '14px 16px' }}>
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
            האם להמשיך באריזה?
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
