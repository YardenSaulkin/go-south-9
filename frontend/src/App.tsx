import { useEffect, useState } from 'react'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import { navigate, usePathname } from './navigation'
import PackingUnitPage, { PackingSuccessScreen, type PackingDraft } from './components/PackingUnitPage'
import { api, type PackingSuccessResponse } from './api'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution'

export default function App() {
  const pathname = usePathname()
  const [packingSuccess, setPackingSuccess] = useState<PackingSuccessResponse | null>(null)
  const [packingDraft, setPackingDraft] = useState<PackingDraft | null>(null)
  const [menuUser, setMenuUser] = useState<{ name: string; role: string } | null>(null)

  useEffect(() => {
    if (pathname === '/') navigate('/home', { replace: true })
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/menu') return
    let active = true
    api.getContext().then((context) => {
      const user = context.users[0]
      if (active && user) setMenuUser({ name: user.email, role: user.role })
    }).catch(() => {
      if (active) setMenuUser(null)
    })
    return () => { active = false }
  }, [pathname])

  const handleNavigate = (route: NavigateRoute) => {
    if (route === 'packing') navigate('/packing')
    else console.log('navigate ->', route)
  }

  const handleBack = () => navigate('/menu')

  if (pathname === '/home') return <HomePage />
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/signup') return <SignUpPage />
  if (pathname === '/packing/success' && packingSuccess) {
    return <PackingSuccessScreen
      response={packingSuccess}
      onContinue={() => {
        setPackingDraft({
          orgScopeId: packingSuccess.source.orgScopeId,
          unit: packingSuccess.source.unit ?? '',
          anaf: packingSuccess.source.anaf ?? '',
          mador: packingSuccess.source.mador ?? '',
          roomId: packingSuccess.source.room ?? '',
          building: packingSuccess.destination.building,
          floor: packingSuccess.destination.floor,
          destinationRoom: packingSuccess.destination.room,
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
    onComplete={(response, draft) => {
      setPackingDraft(draft)
      setPackingSuccess(response)
      navigate('/packing/success')
    }}
  />

  if (!menuUser) return <main className="packing-shell"><p className="packing-loading" role="status">טוען משתמש…</p></main>
  return <LogisticsMainMenu user={menuUser} onNavigate={handleNavigate} />
}
