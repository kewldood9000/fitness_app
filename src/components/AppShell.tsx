import { ChartLine, Dumbbell, House, Settings, Utensils } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AppLogo } from './AppLogo'

interface AppShellProps {
  children: ReactNode
}

const navigation = [
  { to: '/', label: 'Today', icon: House, end: true },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: ChartLine }
]

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const isSettings = location.pathname === '/settings'
  const isNutrition = location.pathname === '/nutrition'

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

      <main className="mx-auto w-full max-w-lg px-5 pb-[calc(6.75rem+env(safe-area-inset-bottom))]">{children}</main>

      <nav aria-label="Primary navigation" className="bottom-nav">
        <div className="mx-auto grid max-w-lg grid-cols-4 px-3 pt-2">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              end={end}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
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
