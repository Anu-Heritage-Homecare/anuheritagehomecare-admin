import { Bell, Menu, Plus, Search } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'

interface TopbarProps {
  navOpen: boolean
  onMenuClick: () => void
}

export function Topbar({ navOpen, onMenuClick }: TopbarProps) {
  return (
    <header className="border-line bg-surface/85 sticky top-0 z-20 border-b backdrop-blur-md print:hidden">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
          className="text-ink-muted hover:bg-sunken grid size-11 shrink-0 place-items-center rounded-lg lg:hidden"
        >
          <Menu className="size-5" strokeWidth={1.8} />
        </button>

        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            strokeWidth={1.8}
          />
          <input
            type="search"
            aria-label="Search operations"
            placeholder="Search operations..."
            // pr only reserves room for the ⌘K hint where that hint is visible
            className="border-control bg-sunken text-ink placeholder:text-ink-subtle focus:bg-surface focus:border-brand-400 h-11 w-full rounded-lg border pr-3 pl-9 text-sm sm:h-9.5 sm:pr-12"
          />
          <kbd className="border-line text-ink-subtle pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-[0.65rem] font-medium sm:block">
            ⌘K
          </kbd>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            // Tinted, not solid. A filled indigo button here competed with
            // the primary action on every page underneath it — on the
            // directory that put two solid indigo buttons in one sightline,
            // and the one in the chrome is not the more important of the two.
            className="bg-brand-50 text-brand-700 hover:bg-brand-100 inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors sm:h-9.5 sm:px-3.5"
          >
            <Plus className="size-4" strokeWidth={2.2} />
            <span className="hidden sm:inline">Quick Action</span>
          </button>

          <button
            type="button"
            aria-label="Notifications"
            className="text-ink-muted hover:bg-sunken border-control relative grid size-11 place-items-center rounded-full border sm:size-9.5"
          >
            <Bell className="size-4.5" strokeWidth={1.8} />
            <span className="absolute top-2 right-2.5 size-1.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {/* Separates the account from the actions beside it, the way the
              design does. Decorative, so `line` rather than `control`. */}
          <span
            aria-hidden="true"
            className="bg-line hidden h-6 w-px shrink-0 sm:block"
          />

          <Avatar
            name="Sarah Jenkins"
            className="ring-line hidden size-9.5 ring-1 sm:grid"
          />
        </div>
      </div>
    </header>
  )
}
