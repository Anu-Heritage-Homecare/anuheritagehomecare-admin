import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/** The System Settings rail, in the Figma's order. */
const settingsSections = [
  { label: 'Organization', to: '/settings/organization' },
  { label: 'Users & Permissions', to: '/settings/users' },
  { label: 'Care Operations', to: '/settings/care-operations' },
  { label: 'Billing & Payments', to: '/settings/billing' },
  { label: 'Notifications', to: '/settings/notifications' },
  { label: 'Security & Integrations', to: '/settings/security' },
]

/**
 * The Settings shell: the section rail on the left, the open section beside
 * it. At lg+ the rail sits flush against the main sidebar and runs the height
 * of the page, as the design draws it — the negative margins cancel the
 * padding `<main>` puts around every screen. Below lg it is a row of pills.
 */
export function SettingsPage() {
  const { pathname } = useLocation()
  const current = settingsSections.find((s) => pathname.startsWith(s.to))

  return (
    <div className="lg:-my-6 lg:-ml-6 lg:flex lg:min-h-[calc(100dvh-4rem)] xl:-ml-8">
      <nav
        aria-label="System settings"
        className="border-line lg:bg-surface print:hidden lg:w-56 lg:shrink-0 lg:border-r"
      >
        <div className="lg:sticky lg:top-16 lg:py-5">
          <p className="text-ink-subtle hidden px-5 pb-2 text-[0.6875rem] font-semibold tracking-wider uppercase lg:block">
            System Settings
          </p>
          <ul className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0">
            {settingsSections.map((s) => (
              <li key={s.to} className="shrink-0">
                <NavLink
                  to={s.to}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-10 items-center justify-between gap-2 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors',
                      'lg:rounded-none lg:border-0 lg:border-l-[3px] lg:pr-4 lg:pl-[1.0625rem]',
                      isActive
                        ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                        : 'border-control text-ink-muted hover:text-ink lg:hover:bg-sunken lg:border-transparent',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {s.label}
                      {isActive && (
                        <ChevronRight className="hidden size-4 lg:block" strokeWidth={2.2} aria-hidden="true" />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="min-w-0 flex-1 lg:py-6 lg:pl-6 xl:pl-8">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm print:hidden">
          <span className="text-ink-muted">Settings</span>
          <ChevronRight className="text-ink-subtle size-3.5" strokeWidth={2} aria-hidden="true" />
          <span aria-current="page" className="text-brand-700 font-medium">
            {current?.label ?? 'Settings'}
          </span>
        </nav>
        <Outlet />
      </div>
    </div>
  )
}
