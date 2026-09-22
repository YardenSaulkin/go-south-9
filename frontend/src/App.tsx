import { useEffect, useState } from 'react'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import { navigate, usePathname } from './navigation'
import PackingUnitPage, { PackingSuccessScreen, type PackingDraft } from './components/PackingUnitPage'
import { type PackingSuccessResponse } from './api'
import { useCurrentUser } from './auth/useCurrentUser'
import { clearCurrentUser, userDisplayName, userRoleLabel } from './auth/session'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution'
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
          roomId: packingSuccess.source.room ?? '',
          building: packingSuccess.destination.building,
          floor: packingSuccess.destination.floor,
          destinationRoom: packingSuccess.destination.room,
          sourceDescription: packingSuccess.source.sourceDescription ?? '',
          destinationDescription: packingSuccess.destination.description ?? '',
          destinationMode: 'existing',
          destinationId: packingSuccess.destination.id ?? '',
          destinationCode: packingSuccess.destination.code,
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
    authenticatedUserId={user.id}
    onBack={handleBack}
    onComplete={(response, draft) => {
      setPackingDraft(draft)
      setPackingSuccess(response)
      navigate('/packing/success')
    }}
  />

  return <LogisticsMainMenu
    user={{
      name: userDisplayName(user),
      personalNumber: user.personalNumber ?? undefined,
      role: userRoleLabel(user),
    }}
    onNavigate={handleNavigate}
    onLogout={handleLogout}
  />
}
