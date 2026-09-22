import { useState } from 'react'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import PackingUnitPage from './components/PackingUnitPage'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution'
type AppRoute = 'menu' | NavigateRoute

const DEMO_USER = {
  name: 'דני',
  personalNumber: '1234567',
  role: 'מפקד',
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>('menu')

  const handleNavigate = (r: NavigateRoute) => setRoute(r)
  const handleBack = () => setRoute('menu')

  if (route === 'packing') return <PackingUnitPage onBack={handleBack} />

  return <LogisticsMainMenu user={DEMO_USER} onNavigate={handleNavigate} />
}
