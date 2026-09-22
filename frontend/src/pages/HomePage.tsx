import { Box, Button } from '@mui/material'
import { LogIn, UserPlus } from 'lucide-react'
import AuthScreen from '../components/auth/AuthScreen'
import { navigate } from '../navigation'

const buttonSx = {
  minHeight: 76,
  borderRadius: '18px',
  fontSize: 20,
  fontWeight: 700,
  gap: 1.5,
  boxShadow: '0 4px 18px rgba(0,0,0,0.14)',
}

export default function HomePage() {
  return (
    <AuthScreen>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button
          variant="contained"
          fullWidth
          disableElevation
          onClick={() => navigate('/login')}
          sx={buttonSx}
        >
          <LogIn size={24} />
          התחברות
        </Button>
        <Button
          variant="contained"
          fullWidth
          disableElevation
          onClick={() => navigate('/signup')}
          sx={{
            ...buttonSx,
            color: '#5a3515',
            backgroundColor: 'rgba(245, 230, 200, 0.9)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.4)',
            '&:hover': { backgroundColor: 'rgba(245, 230, 200, 1)' },
          }}
        >
          <UserPlus size={24} />
          הרשמה
        </Button>
      </Box>
    </AuthScreen>
  )
}
