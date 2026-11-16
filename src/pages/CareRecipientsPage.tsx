import { useState } from 'react'
import { Download, Loader2, Plus } from 'lucide-react'
import { SummaryCards } from '@/features/care-recipients/SummaryCards'
import {
  DirectoryToolbar,
  type DirectoryFilter,
} from '@/features/care-recipients/DirectoryToolbar'
import { RecipientTable } from '@/features/care-recipients/RecipientTable'
import { FooterPanels } from '@/features/care-recipients/FooterPanels'
import { AddRecipientDrawer } from '@/features/care-recipients/AddRecipientDrawer'
import { useRecipientList } from '@/features/care-recipients/useRecipientList'
import { Pagination } from '@/components/ui/Pagination'

const PAGE_SIZE = 8

const emptyCounts: Record<DirectoryFilter, number> = {
  all: 0,
  active: 0,
  'on-hold': 0,
  'high-priority': 0,
  new: 0,
}

export function CareRecipientsPage() {
  const [filter, setFilter] = useState<DirectoryFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)

  const { data, isPending, isError, error, refetch, isFetching } = useRecipientList({
    filter,
    search: query,
    page,
  })

  const onFilterChange = (next: DirectoryFilter) => {
    setFilter(next)
    setPage(1)
  }

  const onQueryChange = (next: string) => {
    setQuery(next)
    setPage(1)
  }

  const total = data?.total ?? 0
  const pageCount = data?.totalPages ?? 1
  const shown = data?.rows.length ?? 0
  const from = shown === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = (page - 1) * PAGE_SIZE + shown

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
        onClose={(created) => {
          setAdding(false)
          if (created) {
            setPage(1)
            void refetch()
          }
        }}
      />

      {isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-ink text-sm font-medium">Could not load care recipients.</p>
          <p className="text-ink-subtle text-sm">{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <SummaryCards summaries={data?.summaries ?? []} />

          <section aria-label="Care recipient directory" className="card overflow-hidden">
            <DirectoryToolbar
              filter={filter}
              onFilterChange={onFilterChange}
              query={query}
              onQueryChange={onQueryChange}
              counts={data?.tabCounts ?? emptyCounts}
            />

            {isPending ? (
              <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Loading care recipients…
              </div>
            ) : (
              <>
                <RecipientTable rows={data.rows} searching={query.trim() !== ''} />

                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  summary={
                    total === 0
                      ? isFetching
                        ? 'Loading…'
                        : 'No care recipients to show'
                      : `Showing ${from}-${to} of ${total} care recipients`
                  }
                />
              </>
            )}
          </section>

          <FooterPanels triggers={data?.triggers ?? []} />
        </>
      )}
    </div>
  )
}
