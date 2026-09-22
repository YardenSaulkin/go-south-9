import { useEffect, useState } from 'react'

const NAVIGATE_EVENT = 'app:navigate'

export function navigate(path: string, { replace = false }: { replace?: boolean } = {}) {
  if (window.location.pathname === path) return
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const update = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', update)
    window.addEventListener(NAVIGATE_EVENT, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(NAVIGATE_EVENT, update)
    }
  }, [])

  return pathname
}
