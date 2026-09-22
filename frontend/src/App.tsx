import LogisticsMainMenu from './components/LogisticsMainMenu'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution'

const DEMO_USER = {
  name: 'דני',
  personalNumber: '1234567',
  role: 'מפקד',
}

export default function App() {
  const handleNavigate = (route: NavigateRoute) => {
    console.log('navigate ->', route)
  }

  return <LogisticsMainMenu user={DEMO_USER} onNavigate={handleNavigate} />
}
