import { useMemo, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import {
  PAGE_SIZE,
  TOTAL_RECIPIENTS,
  recipients,
} from '@/features/care-recipients/data'
import { SummaryCards } from '@/features/care-recipients/SummaryCards'
import {
  DirectoryToolbar,
  type DirectoryFilter,
} from '@/features/care-recipients/DirectoryToolbar'
import { RecipientTable } from '@/features/care-recipients/RecipientTable'
import { FooterPanels } from '@/features/care-recipients/FooterPanels'
import { AddRecipientDrawer } from '@/features/care-recipients/AddRecipientDrawer'
import { Pagination } from '@/components/ui/Pagination'
import type { Recipient } from '@/features/care-recipients/data'

const predicates: Record<DirectoryFilter, (r: Recipient) => boolean> = {
  all: () => true,
  active: (r) => r.status === 'active',
  'on-hold': (r) => r.status === 'on-hold',
  'high-priority': (r) =>
    r.priority === 'high' ||
    r.priority === 'urgent' ||
    r.priority === 'critical',
  new: (r) => r.status === 'new',
}

/*
 * Counts come from the server in a real build. Here they're the mockup's
 * headline figures, scaled from the sample page so the pills stay believable.
 */
const displayCounts: Record<DirectoryFilter, number> = {
  all: TOTAL_RECIPIENTS,
  active: 298,
  'on-hold': 31,
  'high-priority': 24,
  new: 12,
}

export function CareRecipientsPage() {
  const [filter, setFilter] = useState<DirectoryFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  // A snapshot of the shared list, replaced when a recipient is added.
  const [all, setAll] = useState(recipients)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((r) => {
      if (!predicates[filter](r)) return false
      if (!q) return true
      return [r.name, r.ref, r.condition, r.caregiver ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [all, filter, query])

  const filtering = filter !== 'all' || query.trim() !== ''

  /*
   * Paging is driven by the rows actually held, never by TOTAL_RECIPIENTS —
   * otherwise Next walks to page 43 while the same eight rows stay on screen
   * and the summary contradicts the table. TOTAL_RECIPIENTS is only the "of N"
   * framing for the unfiltered view, standing in for a server count.
   */
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const total = filtering ? rows.length : TOTAL_RECIPIENTS
  const from = rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const to = (safePage - 1) * PAGE_SIZE + pageRows.length

  const onFilterChange = (next: DirectoryFilter) => {
    setFilter(next)
    setPage(1)
  }

  const onQueryChange = (next: string) => {
    setQuery(next)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight">
            Care Recipients
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Manage and monitor all individuals receiving care services.
          </p>
        </div>

        <div className="flex flex-col gap-2 min-[420px]:flex-row">
          <button
            type="button"
            className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
          >
            <Download className="size-4" strokeWidth={1.9} />
            Export
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-colors"
          >
            <Plus className="size-4" strokeWidth={2.2} />
            Add Care Recipient
          </button>
        </div>
      </header>

      <AddRecipientDrawer
        open={adding}
        onClose={(recipient) => {
          setAdding(false)
          if (recipient) {
            // New recipients go to the top; show the first page so it is seen.
            setAll([...recipients])
            setPage(1)
          }
        }}
      />

      <SummaryCards />

      <section aria-label="Care recipient directory" className="card overflow-hidden">
        <DirectoryToolbar
          filter={filter}
          onFilterChange={onFilterChange}
          query={query}
          onQueryChange={onQueryChange}
          counts={displayCounts}
        />

        <RecipientTable rows={pageRows} searching={query.trim() !== ''} />

        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
          summary={
            rows.length === 0
              ? 'No care recipients to show'
              : `Showing ${from}-${to} of ${total} care recipients`
          }
        />
      </section>

      <FooterPanels />
    </div>
  )
}
