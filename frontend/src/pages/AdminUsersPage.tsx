import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import { ArrowRight } from 'lucide-react'
import { navigate } from '../navigation'
import { fetchAdminUsers, setUserRole, type AdminUserView } from '../lib/api'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

const ROLE_LABEL: Record<string, string> = {
  admin: 'מנהל',
  poc: 'קצין קישור',
  normal: 'משתמש',
}

const ROLE_COLOR: Record<string, 'error' | 'warning' | 'default'> = {
  admin: 'error',
  poc: 'warning',
  normal: 'default',
}



interface Props {
  userId: string | null
}

export default function AdminUsersPage({ userId }: Props) {
  const [users, setUsers] = useState<AdminUserView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    fetchAdminUsers(userId)
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה בטעינת המשתמשים'))
      .finally(() => setLoading(false))
  }, [userId])

  const handleRoleToggle = async (user: AdminUserView) => {
    if (!userId || user.role === 'admin') return
    const newRole: 'poc' | 'normal' = user.role === 'poc' ? 'normal' : 'poc'
    setUpdating(user.id)
    try {
      await setUserRole(user.id, newRole, userId)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בעדכון תפקיד')
    } finally {
      setUpdating(null)
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
            ניהול משתמשים
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontFamily: 'Heebo, sans-serif' }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {users.map((user) => (
              <Paper key={user.id} elevation={0} sx={{ borderRadius: 2, p: 2, mb: 1.5 }}>
                {/* Row 1: name + role chip */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a' }}>
                    {user.firstName} {user.lastName}
                  </Typography>
                  <Chip
                    label={ROLE_LABEL[user.role] ?? user.role}
                    color={ROLE_COLOR[user.role] ?? 'default'}
                    size="small"
                    sx={{ fontFamily: 'Heebo, sans-serif' }}
                  />
                </Box>
                {/* Row 2: personal number + email */}
                <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.82rem', color: '#666', mb: 0.5 }}>
                  {user.personalNumber ?? '—'} · {user.email}
                </Typography>
                {/* Row 3: org code */}
                <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.82rem', color: '#666', mb: user.role !== 'admin' ? 1 : 0 }}>
                  {user.orgCode ?? '—'}
                </Typography>
                {/* Row 4: action button */}
                {user.role !== 'admin' && (
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    disabled={updating === user.id}
                    onClick={() => handleRoleToggle(user)}
                    color={user.role === 'poc' ? 'error' : 'primary'}
                    sx={
                      user.role === 'normal'
                        ? { fontFamily: 'Heebo, sans-serif', borderColor: '#8B5E3C', color: '#8B5E3C' }
                        : { fontFamily: 'Heebo, sans-serif' }
                    }
                  >
                    {updating === user.id ? (
                      <CircularProgress size={16} />
                    ) : user.role === 'poc' ? (
                      'הסר קצין קישור'
                    ) : (
                      'הפוך לקצין קישור'
                    )}
                  </Button>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </ThemeProvider>
  )
}
