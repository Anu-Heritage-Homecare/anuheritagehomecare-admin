import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { LG_QUERY, useMediaQuery } from '@/lib/useMediaQuery'

export function AdminLayout() {
  const [navRequested, setNavRequested] = useState(false)
  const isDesktop = useMediaQuery(LG_QUERY)

  /*
   * Derived rather than synced through an effect. Growing past lg turns the
   * drawer into permanent chrome, and this way the body scroll lock cannot
   * outlive it — an effect that reset the flag would fire a cascading render
   * and leave a window where the lock is still applied.
   */
  const navOpen = navRequested && !isDesktop

  return (
    <div className="min-h-dvh">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar open={navOpen} onClose={() => setNavRequested(false)} />

      <div className="lg:pl-sidebar print:pl-0">
        <Topbar navOpen={navOpen} onMenuClick={() => setNavRequested(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[100rem] px-4 py-6 focus:outline-hidden sm:px-6 lg:px-6 xl:px-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
