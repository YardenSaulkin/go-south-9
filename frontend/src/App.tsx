import { useEffect, useState, type ReactNode } from 'react'
import { Box } from '@mui/material'
import AppLogo from './components/AppLogo'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import BottomNavBar from './components/BottomNavBar'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import AdminUsersPage from './pages/AdminUsersPage'
import PocDashboardPage from './pages/PocDashboardPage'
import ShipmentsStatusPage from './pages/ShipmentsStatusPage'
import PackingUnitsStatusPage from './pages/PackingUnitsStatusPage'
import { navigate, usePathname } from './navigation'
import PackingUnitPage from './components/PackingUnitPage'
import ShipmentPage from './components/ShipmentPage'
import DistributionPage from './components/DistributionPage'
import ReceivingPage from './components/ReceivingPage'
import { useCurrentUser } from './auth/useCurrentUser'
import { clearCurrentUser, userDisplayName } from './auth/session'

// Routes that manage their own bottom navbar (or need none)
const NO_NAVBAR_ROUTES = [
  '/home', '/login', '/signup',
  '/packing', '/transport',
  '/receiving', '/distribution',
  '/status/shipments', '/status/packing-units',
]

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution' | 'admin' | 'poc'

const PUBLIC_ROUTES = ['/home', '/login', '/signup']

export default function App() {
  const pathname = usePathname()
  const user = useCurrentUser()
  const [menuTab, setMenuTab] = useState<'sending' | 'receiving'>('sending')

  useEffect(() => {
    if (pathname === '/') {
      navigate('/home', { replace: true })
    }
  }, [])

  useEffect(() => {
    if (!user && pathname !== '/' && !PUBLIC_ROUTES.includes(pathname)) {
      navigate('/home', { replace: true })
    }
  }, [user, pathname])

  const handleNavigate = (route: NavigateRoute) => {
    if (route === 'packing') navigate('/packing')
    else if (route === 'transport') navigate('/transport')
    else if (route === 'distribution') navigate('/distribution')
    else if (route === 'receiving') navigate('/receiving')
    else if (route === 'admin') navigate('/admin/users')
    else if (route === 'poc') navigate('/poc/dashboard')
  }

  const handleBack = () => navigate('/menu')

  const handleLogout = () => {
    clearCurrentUser()
    navigate('/home')
  }

  const showNavBar = !!user && !NO_NAVBAR_ROUTES.includes(pathname)
  const navActive =
    pathname === '/status/shipments' ? 'shipments' :
    pathname === '/status/packing-units' ? 'packing-units' :
    pathname === '/menu' ? 'home' : undefined

  if (pathname === '/home') return <HomePage />
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/signup') return <SignUpPage />
  if (!user) return <HomePage />

  let page: ReactNode
  if (pathname === '/admin/users') page = <AdminUsersPage userId={user.id} />
  else if (pathname === '/poc/dashboard') page = <PocDashboardPage userId={user.id} />
  else if (pathname === '/status/shipments') page = <ShipmentsStatusPage userId={user.id} />
  else if (pathname === '/status/packing-units') page = <PackingUnitsStatusPage userId={user.id} />
  else if (pathname === '/packing') page = <PackingUnitPage onBack={handleBack} orgScope={{ mador: user.orgCode?.substring(4, 6) }} />
  else if (pathname === '/distribution') page = <DistributionPage onBack={handleBack} userId={user.id} orgScopeId={user.orgScopeId} />
  else if (pathname === '/transport') page = <ShipmentPage onBack={handleBack} userId={user.id} orgScopeId={user.orgScopeId} />
  else if (pathname === '/receiving') page = <ReceivingPage userId={user.id} onExit={handleBack} onNavigate={handleNavigate} />
  else page = (
<<<<<<< Updated upstream
    <>
      <AppLogo />
      <LogisticsMainMenu
        user={{ name: userDisplayName(user), personalNumber: user.personalNumber ?? undefined, role: user.role }}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
    </>
=======
    <LogisticsMainMenu
      user={{ name: userDisplayName(user), personalNumber: user.personalNumber ?? undefined, role: user.role }}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      activeTab={menuTab}
      onTabChange={setMenuTab}
    />
>>>>>>> Stashed changes
  )

  return (
    <Box sx={{ pb: showNavBar ? '62px' : 0 }}>
      {page}
      {showNavBar && <BottomNavBar active={navActive} />}
    </Box>
  )
}
