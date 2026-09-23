import { useEffect, type ReactNode } from 'react'
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
import FacilityHomePage from './facility/pages/FacilityHomePage'
import ReportFlowPage from './facility/pages/ReportFlowPage'
import MyReportsPage from './facility/pages/MyReportsPage'
import RoomsFlowPage from './facility/pages/RoomsFlowPage'
import CompoundNavigationPage from './facility/pages/CompoundNavigationPage'
import FacilityInsightsPage from './facility/pages/FacilityInsightsPage'
import { useCurrentUser } from './auth/useCurrentUser'
import { clearCurrentUser, userDisplayName } from './auth/session'

const NO_NAVBAR_ROUTES = ['/home', '/login', '/signup']

// Facility mode brings its own bottom navigation, so the logistics one stays
// off on every screen inside it.
const FACILITY_ROUTE_PREFIX = '/facility'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution' | 'admin' | 'poc'

const PUBLIC_ROUTES = ['/home', '/login', '/signup']

export default function App() {
  const pathname = usePathname()
  const user = useCurrentUser()

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

  const inFacilityMode = pathname.startsWith(FACILITY_ROUTE_PREFIX)
  const showNavBar = !!user && !inFacilityMode && !NO_NAVBAR_ROUTES.includes(pathname)
  const navActive =
    pathname === '/status/shipments' ? 'shipments' :
    pathname === '/status/packing-units' ? 'packing-units' :
    pathname === '/menu' ? 'home' : undefined

  if (pathname === '/home') return <HomePage />
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/signup') return <SignUpPage />
  if (!user) return <HomePage />

  let page: ReactNode
  if (pathname === '/facility') page = <FacilityHomePage user={user} />
  else if (pathname === '/facility/report') page = <ReportFlowPage />
  else if (pathname === '/facility/reports') page = <MyReportsPage />
  else if (pathname === '/facility/rooms') page = <RoomsFlowPage />
  else if (pathname === '/facility/navigate') page = <CompoundNavigationPage />
  else if (pathname === '/facility/insights') page = <FacilityInsightsPage />
  else if (pathname === '/admin/users') page = <AdminUsersPage userId={user.id} />
  else if (pathname === '/poc/dashboard') page = <PocDashboardPage userId={user.id} />
  else if (pathname === '/status/shipments') page = <ShipmentsStatusPage userId={user.id} />
  else if (pathname === '/status/packing-units') page = <PackingUnitsStatusPage userId={user.id} />
  else if (pathname === '/packing') page = <PackingUnitPage onBack={handleBack} orgScope={{ mador: user.orgCode?.substring(4, 6) }} />
  else if (pathname === '/distribution') page = <DistributionPage onBack={handleBack} userId={user.id} orgScopeId={user.orgScopeId} />
  else if (pathname === '/transport') page = <ShipmentPage onBack={handleBack} userId={user.id} orgScopeId={user.orgScopeId} />
  else if (pathname === '/receiving') page = <ReceivingPage userId={user.id} onExit={handleBack} onNavigate={handleNavigate} />
  else page = (
    <>
      <AppLogo />
      <LogisticsMainMenu
        user={{ name: userDisplayName(user), personalNumber: user.personalNumber ?? undefined, role: user.role }}
        onNavigate={handleNavigate}
        onEnterFacilityMode={() => navigate('/facility')}
        onLogout={handleLogout}
      />
    </>
  )

  return (
    <Box sx={{ pb: showNavBar ? '62px' : 0 }}>
      {page}
      {showNavBar && <BottomNavBar active={navActive} />}
    </Box>
  )
}
