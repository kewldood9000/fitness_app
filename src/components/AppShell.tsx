import { ChartLine, Dumbbell, House, Settings, Utensils } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AppLogo } from './AppLogo'
import { preloadRoute } from '@/app/routeLoaders'

interface AppShellProps {
  children: ReactNode
}

const navigation = [
  { to: '/', label: 'Today', icon: House, end: true },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: ChartLine }
]

function useKeyboardViewport() {
  useEffect(() => {
    const root = document.documentElement
    const visualViewport = window.visualViewport
    let largestViewportHeight = Math.max(window.innerHeight, visualViewport?.height ?? 0)
    let revealTimer: number | undefined
    let viewportSettleTimer: number | undefined
    let restoreTimer: number | undefined
    let keyboardWasOpen = false
    const savedScrollPositions = new Map<HTMLElement, number>()

    function revealFocusedField() {
      const focused = document.activeElement
      if (!(focused instanceof HTMLElement) || !focused.matches('input, textarea, select, [contenteditable="true"]')) return
      const scroller = focused.closest<HTMLElement>('.modal-scroll')
      if (!scroller) {
        focused.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        return
      }
      const fieldBounds = focused.getBoundingClientRect()
      const scrollBounds = scroller.getBoundingClientRect()
      const breathingRoom = 20
      const visibleTop = visualViewport?.offsetTop ?? 0
      const visibleBottom = visibleTop + (visualViewport?.height ?? window.innerHeight)
      const usableTop = Math.max(scrollBounds.top, visibleTop) + breathingRoom
      const usableBottom = Math.min(scrollBounds.bottom, visibleBottom) - breathingRoom
      if (fieldBounds.bottom > usableBottom) scroller.scrollBy({ behavior: 'auto', top: fieldBounds.bottom - usableBottom })
      else if (fieldBounds.top < usableTop) scroller.scrollBy({ behavior: 'auto', top: fieldBounds.top - usableTop })
    }

    function scheduleReveal(delay = 220) {
      window.clearTimeout(revealTimer)
      revealTimer = window.setTimeout(revealFocusedField, delay)
    }

    function commitViewport(keyboardOpen: boolean, keyboardOccludedHeight: number) {
      if (!keyboardOpen) {
        largestViewportHeight = Math.max(window.innerHeight, visualViewport?.height ?? 0)
        root.style.setProperty('--stable-viewport-height', `${Math.round(largestViewportHeight)}px`)
        root.style.setProperty('--stable-modal-max-height', `${Math.round(largestViewportHeight * 0.84)}px`)
      }
      root.style.setProperty('--keyboard-occluded-height', `${Math.round(keyboardOccludedHeight)}px`)
      root.classList.toggle('keyboard-open', keyboardOpen)

      if (!keyboardOpen && keyboardWasOpen) {
        window.clearTimeout(restoreTimer)
        restoreTimer = window.setTimeout(() => {
          savedScrollPositions.forEach((scrollTop, scroller) => scroller.scrollTo({ behavior: 'auto', top: scrollTop }))
          savedScrollPositions.clear()
        }, 200)
      }
      keyboardWasOpen = keyboardOpen
      if (keyboardOpen) scheduleReveal(220)
    }

    function updateViewport({ immediate = false } = {}) {
      const viewportHeight = visualViewport?.height ?? window.innerHeight
      const viewportTop = visualViewport?.offsetTop ?? 0
      largestViewportHeight = Math.max(largestViewportHeight, viewportHeight)
      const keyboardThreshold = Math.max(120, largestViewportHeight * 0.18)
      const keyboardOpen = largestViewportHeight - viewportHeight > keyboardThreshold
      const keyboardOccludedHeight = keyboardOpen ? Math.max(0, largestViewportHeight - viewportHeight - viewportTop) : 0
      window.clearTimeout(viewportSettleTimer)
      if (immediate) commitViewport(keyboardOpen, keyboardOccludedHeight)
      else viewportSettleTimer = window.setTimeout(() => commitViewport(keyboardOpen, keyboardOccludedHeight), 120)
    }

    function resetViewportBaseline() {
      largestViewportHeight = Math.max(window.innerHeight, visualViewport?.height ?? 0)
      updateViewport({ immediate: true })
    }

    function handleViewportChange() {
      updateViewport()
    }

    function handleFocusIn() {
      if (!keyboardWasOpen && savedScrollPositions.size === 0) {
        document.querySelectorAll<HTMLElement>('.keyboard-reflow-modal .modal-scroll').forEach((scroller) => savedScrollPositions.set(scroller, scroller.scrollTop))
      }
      scheduleReveal()
    }

    updateViewport({ immediate: true })
    visualViewport?.addEventListener('resize', handleViewportChange)
    visualViewport?.addEventListener('scroll', handleViewportChange)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('orientationchange', resetViewportBaseline)
    document.addEventListener('focusin', handleFocusIn)

    return () => {
      visualViewport?.removeEventListener('resize', handleViewportChange)
      visualViewport?.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('orientationchange', resetViewportBaseline)
      document.removeEventListener('focusin', handleFocusIn)
      window.clearTimeout(revealTimer)
      window.clearTimeout(viewportSettleTimer)
      window.clearTimeout(restoreTimer)
      savedScrollPositions.clear()
      root.classList.remove('keyboard-open')
      root.style.removeProperty('--stable-viewport-height')
      root.style.removeProperty('--stable-modal-max-height')
      root.style.removeProperty('--keyboard-occluded-height')
    }
  }, [])
}

export function AppShell({ children }: AppShellProps) {
  useKeyboardViewport()
  const location = useLocation()
  const [pendingPath, setPendingPath] = useState<string>()
  const isSettings = location.pathname === '/settings'
  const isNutrition = location.pathname === '/nutrition'

  useEffect(() => setPendingPath(undefined), [location.key])

  return (
    <div className="app-canvas">
      {!isNutrition && <header className="app-header sticky top-0 z-20 flex items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <AppLogo />
          <NavLink
            aria-label="Open settings"
            className={({ isActive }) => `icon-button ${isActive || isSettings ? 'icon-button-active' : ''}`}
            to="/settings"
          >
            <Settings className="size-[19px]" strokeWidth={2} />
          </NavLink>
        </header>}

      <main className="app-main mx-auto w-full max-w-lg px-5 pb-[calc(6.75rem+env(safe-area-inset-bottom))]">{children}</main>

      <nav aria-label="Primary navigation" className="bottom-nav">
        <div className="mx-auto grid max-w-lg grid-cols-4 px-3 pt-2">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              end={end}
              to={to}
              className={({ isActive }) => `nav-item ${isActive || pendingPath === to ? 'nav-item-active' : ''}`}
              onClick={() => window.setTimeout(() => setPendingPath(undefined), 400)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setPendingPath(to) }}
              onPointerCancel={() => setPendingPath(undefined)}
              onPointerDown={() => { preloadRoute(to); setPendingPath(to) }}
            >
              <Icon className="size-5" strokeWidth={2.1} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
