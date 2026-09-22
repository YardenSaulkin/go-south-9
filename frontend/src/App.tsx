import { useEffect } from 'react'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import AdminUsersPage from './pages/AdminUsersPage'
import PocDashboardPage from './pages/PocDashboardPage'
import { navigate, usePathname } from './navigation'
import PackingUnitPage from './components/PackingUnitPage'
import ShipmentPage from './components/ShipmentPage'
import { useCurrentUser } from './auth/useCurrentUser'
import { clearCurrentUser, userDisplayName } from './auth/session'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution' | 'admin' | 'poc'

const PUBLIC_ROUTES = ['/home', '/login', '/signup']

export default function App() {
  const pathname = usePathname()
  const user = useCurrentUser()

  useEffect(() => {
    if (pathname === '/') navigate('/home', { replace: true })
  }, [])

  useEffect(() => {
    if (!user && pathname !== '/' && !PUBLIC_ROUTES.includes(pathname)) {
      navigate('/home', { replace: true })
    }
  }, [user, pathname])

  const handleNavigate = (route: NavigateRoute) => {
    if (route === 'packing') navigate('/packing')
    else if (route === 'transport') navigate('/transport')
    else if (route === 'admin') navigate('/admin/users')
    else if (route === 'poc') navigate('/poc/dashboard')
    else console.log('navigate ->', route)
  }

  const handleBack = () => navigate('/menu')

  const handleLogout = () => {
    clearCurrentUser()
    navigate('/home')
  }

  if (pathname === '/home') return <HomePage />
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/signup') return <SignUpPage />

  if (!user) return null

  // Role-guarded routes
  if (pathname === '/admin/users') {
    if (user.role !== 'admin') { navigate('/menu', { replace: true }); return null }
    return <AdminUsersPage userId={user.id} />
  }
  if (pathname === '/poc/dashboard') {
    if (user.role !== 'poc' && user.role !== 'admin') { navigate('/menu', { replace: true }); return null }
    return <PocDashboardPage userId={user.id} />
  }

  if (pathname === '/packing') return <PackingUnitPage onBack={handleBack} />
  if (pathname === '/transport')
    return <ShipmentPage onBack={handleBack} userId={user.id} orgScopeId={user.orgScopeId} />

  return (
    <LogisticsMainMenu
      user={{
        name: userDisplayName(user),
        personalNumber: user.personalNumber ?? undefined,
        role: user.role,
      }}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    />
  )
}
