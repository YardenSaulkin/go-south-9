import { useEffect } from 'react'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import { navigate, usePathname } from './navigation'
import PackingUnitPage from './components/PackingUnitPage'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution'

const DEMO_USER = {
  name: 'דני',
  personalNumber: '1234567',
  role: 'מפקד',
}

export default function App() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === '/') navigate('/home', { replace: true })
  }, [])

  const handleNavigate = (route: NavigateRoute) => {
    if (route === 'packing') navigate('/packing')
    else console.log('navigate ->', route)
  }

  const handleBack = () => navigate('/menu')

  if (pathname === '/home') return <HomePage />
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/signup') return <SignUpPage />
  if (pathname === '/packing') return <PackingUnitPage onBack={handleBack} />

  return <LogisticsMainMenu user={DEMO_USER} onNavigate={handleNavigate} />
}
