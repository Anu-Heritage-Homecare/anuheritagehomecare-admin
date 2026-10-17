import { useState } from 'react'
import { PenSquare, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { folderIcons, folderLabels, folderOrder } from './folders'
import type { Folder } from './folders'

interface FolderRailProps {
  folder: Folder
  counts: Record<Folder, number>
  onSelect: (folder: Folder) => void
  onCompose: () => void
}

/**
 * Vertical beside the list from `lg`, a horizontal rail of chips below it —
 * the same pattern the live board and the alerts register use for their filter
 * rails, rather than a fourth column that would leave nothing for the reading.
 *
 * The search filters the rail, not the messages: the list has its own box, and
 * two search fields that did the same thing would be one too many.
 */
export function FolderRail({
  folder,
  counts,
  onSelect,
  onCompose,
}: FolderRailProps) {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()
  const shown = folderOrder.filter(
    (value) => term === '' || folderLabels[value].toLowerCase().includes(term),
  )

  return (
    <nav aria-label="Message folders" className="min-w-0 space-y-3">
      <button
        type="button"
        onClick={onCompose}
        className="bg-brand-600 hover:bg-brand-700 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
      >
        <PenSquare
          className="size-4 shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
        New Message
      </button>

      <label className="relative block">
        <span className="sr-only">Search folders</span>
        <Search
          className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          strokeWidth={1.9}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search folders..."
          className="border-line focus:border-brand-500 h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
        />
      </label>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {shown.map((value) => {
          const Icon = folderIcons[value]
          const active = folder === value
          return (
            <button
              key={value}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => onSelect(value)}
              className={cn(
                `flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm
                 whitespace-nowrap transition-colors lg:w-full`,
                active
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-ink-muted hover:bg-sunken hover:text-ink font-medium',
              )}
            >
              <Icon
                className={cn('size-4 shrink-0', active && 'text-brand-600')}
                strokeWidth={1.9}
                aria-hidden="true"
              />
              <span className="min-w-0 lg:truncate">{folderLabels[value]}</span>
              <span
                className={cn(
                  'ml-auto inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                  active
                    ? 'bg-brand-600 text-white'
                    : 'bg-sunken text-ink-muted',
                )}
              >
                {counts[value]}
              </span>
            </button>
          )
        })}
        {shown.length === 0 && (
          <p className="text-ink-subtle px-3 py-2 text-sm">
            No folder by that name.
          </p>
        )}
      </div>
    </nav>
  )
}
