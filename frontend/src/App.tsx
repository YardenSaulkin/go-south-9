import { useEffect, useState } from 'react'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import AdminUsersPage from './pages/AdminUsersPage'
import PocDashboardPage from './pages/PocDashboardPage'
import { navigate, usePathname } from './navigation'
import PackingUnitPage from './components/PackingUnitPage'
import ShipmentPage from './components/ShipmentPage'
import { fetchContext, type DemoUser, type OrgScope } from './lib/api'
import { getCurrentUser } from './auth/session'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution' | 'admin' | 'poc'

const FALLBACK_USER = {
  name: 'דני',
  personalNumber: '1234567',
  role: 'normal' as const,
}

export default function App() {
  const pathname = usePathname()
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null)
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)
  const sessionUser = getCurrentUser()

  useEffect(() => {
    if (pathname === '/') navigate('/home', { replace: true })
  }, [])

  useEffect(() => {
    fetchContext()
      .then(({ users, scopes }) => {
        // Prefer the logged-in session user if available
        const target = sessionUser
          ? users.find((u) => u.id === sessionUser.id)
          : users.find((u) => u.role === 'poc') ?? users.find((u) => u.role === 'normal') ?? users[0]
        if (!target) return
        setDemoUser(target)
        if (target.orgScopeId) {
          const scope = scopes.find((s) => s.id === target.orgScopeId) ?? scopes[0]
          setOrgScope(scope ?? null)
        } else if (scopes.length > 0) {
          setOrgScope(scopes[0])
        }
      })
      .catch((err) => console.warn('Could not load backend context:', err))
  }, [sessionUser?.id])

  const handleNavigate = (route: NavigateRoute) => {
    if (route === 'packing') navigate('/packing')
    else if (route === 'transport') navigate('/transport')
    else if (route === 'admin') navigate('/admin/users')
    else if (route === 'poc') navigate('/poc/dashboard')
    else console.log('navigate ->', route)
  }

  const handleBack = () => navigate('/menu')

  const currentRole = sessionUser?.role ?? demoUser?.role ?? 'normal'

  const displayUser = demoUser
    ? {
        name: `${demoUser.firstName ?? ''} ${demoUser.lastName ?? ''}`.trim() || demoUser.email.split('@')[0],
        personalNumber: demoUser.personalNumber ?? demoUser.id,
        role: currentRole,
      }
    : FALLBACK_USER

  if (pathname === '/home') return <HomePage />
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/signup') return <SignUpPage />

  // Role-guarded routes
  if (pathname === '/admin/users') {
    if (currentRole !== 'admin') { navigate('/menu', { replace: true }); return null }
    return <AdminUsersPage userId={demoUser?.id ?? sessionUser?.id ?? null} />
  }
  if (pathname === '/poc/dashboard') {
    if (currentRole !== 'poc' && currentRole !== 'admin') { navigate('/menu', { replace: true }); return null }
    return <PocDashboardPage userId={demoUser?.id ?? sessionUser?.id ?? null} />
  }

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
