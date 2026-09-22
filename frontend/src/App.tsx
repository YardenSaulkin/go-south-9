import { useEffect, useState } from 'react'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import { navigate, usePathname } from './navigation'
import PackingUnitPage from './components/PackingUnitPage'
import ShipmentPage from './components/ShipmentPage'
import { fetchContext, type DemoUser, type OrgScope } from './lib/api'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution'

const FALLBACK_USER = {
  name: 'דני',
  personalNumber: '1234567',
  role: 'מפקד',
}

export default function App() {
  const pathname = usePathname()
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null)
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)

  useEffect(() => {
    if (pathname === '/') navigate('/home', { replace: true })
  }, [])

  useEffect(() => {
    fetchContext()
      .then(({ users, scopes }) => {
        const logisticsUser = users.find((u) => u.role === 'logistics_user') ?? users[0]
        if (!logisticsUser) return
        setDemoUser(logisticsUser)
        if (logisticsUser.orgScopeId) {
          const scope = scopes.find((s) => s.id === logisticsUser.orgScopeId) ?? scopes[0]
          setOrgScope(scope ?? null)
        } else if (scopes.length > 0) {
          setOrgScope(scopes[0])
        }
      })
      .catch((err) => console.warn('Could not load backend context:', err))
  }, [])

  const handleNavigate = (route: NavigateRoute) => {
    if (route === 'packing') navigate('/packing')
    else if (route === 'transport') navigate('/transport')
    else console.log('navigate ->', route)
  }

  const handleBack = () => navigate('/menu')

  const displayUser = demoUser
    ? { name: demoUser.email.split('@')[0], personalNumber: demoUser.id, role: demoUser.role }
    : FALLBACK_USER

  if (pathname === '/home') return <HomePage />
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/signup') return <SignUpPage />
  if (pathname === '/packing') return <PackingUnitPage onBack={handleBack} />
  if (pathname === '/transport')
    return (
      <ShipmentPage
        onBack={handleBack}
        userId={demoUser?.id ?? null}
        orgScopeId={orgScope?.id ?? null}
      />
    )

  return <LogisticsMainMenu user={displayUser} onNavigate={handleNavigate} />
}
