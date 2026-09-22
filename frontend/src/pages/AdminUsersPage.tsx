import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#8B5E3C' }}>
                  {['שם', 'מספר אישי', 'אימייל', 'יחידה', 'תפקיד', 'פעולה'].map((h) => (
                    <TableCell
                      key={h}
                      align="right"
                      sx={{ color: 'white', fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(139,94,60,0.05)' } }}
                  >
                    <TableCell align="right" sx={{ fontFamily: 'Heebo, sans-serif' }}>
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'Heebo, sans-serif', dir: 'ltr' }}>
                      {user.personalNumber ?? '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'Heebo, sans-serif', dir: 'ltr' }}>
                      {user.email}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'Heebo, sans-serif' }}>
                      {user.orgNames?.unit ?? user.orgCode?.substring(0, 2) ?? '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={ROLE_LABEL[user.role] ?? user.role}
                        color={ROLE_COLOR[user.role] ?? 'default'}
                        size="small"
                        sx={{ fontFamily: 'Heebo, sans-serif' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {user.role !== 'admin' && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={updating === user.id}
                          onClick={() => handleRoleToggle(user)}
                          sx={{
                            fontFamily: 'Heebo, sans-serif',
                            borderColor: '#8B5E3C',
                            color: '#8B5E3C',
                          }}
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </ThemeProvider>
  )
}
