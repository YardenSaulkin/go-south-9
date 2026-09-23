import { Box, IconButton } from '@mui/material'
import { Truck, Package, Home } from 'lucide-react'
import { navigate } from '../navigation'

interface BottomNavBarProps {
  active?: 'shipments' | 'packing-units' | 'home'
}

export default function BottomNavBar({ active }: BottomNavBarProps) {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        height: '62px',
        backgroundColor: '#cd7937',
        borderTop: '1px solid rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        px: 2,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.15)',
      }}
    >
      <IconButton
        onClick={() => navigate('/status/shipments')}
        sx={{
          color: active === 'shipments' ? '#2d1604' : '#3f2108',
          p: 1.2,
          backgroundColor: active === 'shipments' ? 'rgba(255,255,255,0.2)' : 'transparent',
          borderRadius: '12px',
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
        }}
        title="סטטוס הובלות"
      >
        <Truck size={28} strokeWidth={1.8} />
      </IconButton>

      <IconButton
        onClick={() => navigate('/status/packing-units')}
        sx={{
          color: active === 'packing-units' ? '#2d1604' : '#3f2108',
          p: 1.2,
          backgroundColor: active === 'packing-units' ? 'rgba(255,255,255,0.2)' : 'transparent',
          borderRadius: '12px',
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
        }}
        title="סטטוס אריזות"
      >
        <Package size={28} strokeWidth={1.8} />
      </IconButton>

      <IconButton
        onClick={() => navigate('/menu')}
        sx={{
          color: active === 'home' ? '#2d1604' : '#3f2108',
          p: 1.2,
          backgroundColor: active === 'home' ? 'rgba(255,255,255,0.2)' : 'transparent',
          borderRadius: '12px',
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' },
        }}
        title="תפריט ראשי"
      >
        <Home size={28} strokeWidth={1.8} />
      </IconButton>
    </Box>
  )
}
