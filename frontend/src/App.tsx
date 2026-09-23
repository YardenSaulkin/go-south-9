import { useEffect, useState } from 'react'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import AdminUsersPage from './pages/AdminUsersPage'
import PocDashboardPage from './pages/PocDashboardPage'
import { navigate, usePathname } from './navigation'
import PackingUnitPage, { PackingSuccessScreen, type PackingDraft } from './components/PackingUnitPage'
import ShipmentPage from './components/ShipmentPage'
import { useCurrentUser } from './auth/useCurrentUser'
import { clearCurrentUser, userDisplayName } from './auth/session'
import type { PackingSuccessResponse } from './api/packing'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution' | 'admin' | 'poc'

const PUBLIC_ROUTES = ['/home', '/login', '/signup']

export default function App() {
  const pathname = usePathname()
  const user = useCurrentUser()
  const [packingSuccess, setPackingSuccess] = useState<PackingSuccessResponse | null>(null)
  const [packingDraft, setPackingDraft] = useState<PackingDraft | null>(null)

  useEffect(() => {
    if (pathname === '/') navigate('/home', { replace: true })
  }, [pathname])

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
    setPackingDraft(null)
    setPackingSuccess(null)
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

  if (pathname === '/packing/success' && packingSuccess) {
    return <PackingSuccessScreen
      response={packingSuccess}
      onContinue={() => {
        setPackingDraft({
          orgScopeId: packingSuccess.source.orgScopeId,
          unit: packingSuccess.source.unit ?? '',
          anaf: packingSuccess.source.anaf ?? '',
          mador: packingSuccess.source.mador ?? '',
          team: packingSuccess.source.team ?? '',
          roomId: packingSuccess.source.roomId ?? '',
          building: packingSuccess.destination.building ?? '',
          floor: packingSuccess.destination.floor ?? '',
          destinationRoom: packingSuccess.destination.room ?? '',
          sourceDescription: packingSuccess.source.description ?? '',
          destinationDescription: packingSuccess.destination.description ?? '',
          destinationMode: 'existing',
          destinationId: packingSuccess.destination.id ?? '',
        })
        setPackingSuccess(null)
        navigate('/packing')
      }}
      onHome={() => {
        setPackingDraft(null)
        setPackingSuccess(null)
        navigate('/home')
      }}
    />
  }
  if (pathname === '/packing') return <PackingUnitPage
    key={packingDraft ? 'retained-packing' : 'new-packing'}
    initialDraft={packingDraft}
    onBack={handleBack}
    onComplete={(response, draft) => { setPackingDraft(draft); setPackingSuccess(response); navigate('/packing/success') }}
  />
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
