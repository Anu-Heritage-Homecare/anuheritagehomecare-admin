import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  FileText,
  FolderOpen,
  Loader2,
  Search,
  TriangleAlert,
} from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import {
  DOCUMENTS_PAGE_SIZE,
  categories,
  categoryCounts,
  countByStatus,
  documentSortOptions,
  documentStatusLabels,
  effectiveStatus,
  formatUploadDate,
  lastUpload,
  presentStatuses,
  sortDocuments,
  type DocumentCategory,
  type DocumentSort,
  type DocumentStatus,
} from '../documents-data'
import { useRecipientDocuments } from '../useRecipientDocuments'
import { DocumentTable } from './DocumentTable'
import { DocumentActivity } from './DocumentActivity'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { toneChip, toneText } from '@/lib/tone'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types'

type CategoryFilter = DocumentCategory | 'all'
type StatusFilter = DocumentStatus | 'all'

export function DocumentsTab() {
  const profile = useOutletContext<RecipientProfile>()
  const { data, isPending, isError, error, refetch } = useRecipientDocuments(profile.id)
  const documents = useMemo(() => data ?? [], [data])

  const [category, setCategory] = useState<CategoryFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<DocumentSort>('newest')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const pending = countByStatus(documents, 'pending')
  const expiring = countByStatus(documents, 'expiring')
  const latest = lastUpload(documents)

  // Only statuses that exist — otherwise the dropdown offers dead options.
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...presentStatuses(documents).map((s) => ({
        value: s,
        label: documentStatusLabels[s],
      })),
    ],
    [documents],
  )

  /*
   * Pill counts reflect the status filter and the search, so they can't read
   * "Medical Records 5" above a table showing one row. Category is applied
   * after, since a pill shouldn't affect its own count.
   */
  const beforeCategory = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents.filter((d) => {
      if (status !== 'all' && effectiveStatus(d) !== status) return false
      if (!q) return true
      return [d.name, d.category, d.uploadedBy]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [documents, status, query])

  const counts = useMemo(() => categoryCounts(beforeCategory), [beforeCategory])

  const rows = useMemo(() => {
    const filtered =
      category === 'all'
        ? beforeCategory
        : beforeCategory.filter((d) => d.category === category)
    return sortDocuments(filtered, sort)
  }, [beforeCategory, category, sort])

  if (isPending) {
    return (
      <div className="card text-ink-subtle flex items-center justify-center gap-2 px-6 py-20 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading documents…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <h2 className="text-ink text-sm font-semibold">Could not load documents</h2>
        <p className="text-ink-muted mt-1 text-sm">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <FolderOpen className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">No documents</h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          {profile.name} has no documents on file. Care plans, consents and
          certifications appear here once uploaded.
        </p>
        <button
          type="button"
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Upload Document
        </button>
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / DOCUMENTS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = rows.slice(
    (safePage - 1) * DOCUMENTS_PAGE_SIZE,
    safePage * DOCUMENTS_PAGE_SIZE,
  )
  const from = rows.length === 0 ? 0 : (safePage - 1) * DOCUMENTS_PAGE_SIZE + 1
  const to = (safePage - 1) * DOCUMENTS_PAGE_SIZE + pageRows.length

  /** Any filter change restarts paging. */
  const reset =
    <T,>(setter: (v: T) => void) =>
    (value: T) => {
      setter(value)
      setPage(1)
    }

  // Every headline is counted from the list rather than stated beside it.
  const stats: {
    id: string
    label: string
    value: string
    icon: typeof FileText
    tone: Tone
    emphasise?: boolean
  }[] = [
    {
      id: 'total',
      label: 'Total Documents',
      value: String(documents.length),
      icon: FileText,
      tone: 'blue',
    },
    {
      id: 'pending',
      label: 'Pending Review',
      value: String(pending),
      icon: TriangleAlert,
      tone: 'amber',
      emphasise: pending > 0,
    },
    {
      id: 'expiring',
      label: 'Expiring Soon',
      value: String(expiring),
      icon: Clock,
      tone: 'red',
      emphasise: expiring > 0,
    },
    {
      id: 'latest',
      label: 'Last Upload',
      value: latest ? formatUploadDate(latest) : '—',
      icon: CalendarDays,
      tone: 'slate',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ id, label, value, icon: Icon, tone, emphasise }) => (
          <article key={id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-ink-muted text-sm font-medium">{label}</p>
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-lg',
                  toneChip[tone],
                )}
              >
                <Icon className="size-4" strokeWidth={1.9} aria-hidden="true" />
              </span>
            </div>
            <p
              className={cn(
                'mt-3 text-2xl font-bold tracking-tight break-words',
                emphasise ? toneText[tone] : 'text-ink',
              )}
            >
              {value}
            </p>
          </article>
        ))}
      </div>

      <div
        role="group"
        aria-label="Filter documents by category"
        className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1"
      >
        {(['all', ...categories] as CategoryFilter[]).map((c) => {
          const selected = category === c
          const count = c === 'all' ? beforeCategory.length : counts[c]
          return (
            <button
              key={c}
              type="button"
              aria-pressed={selected}
              onClick={() => reset(setCategory)(c)}
              className={cn(
                'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors',
                selected
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-muted hover:bg-sunken',
              )}
            >
              {c === 'all' ? 'All' : c}
              <span
                className={cn(
                  'text-xs tabular-nums',
                  selected ? 'text-white' : 'text-ink-subtle',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <section aria-label="Document library" className="card overflow-hidden">
        <div className="border-line flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative lg:w-72">
            <Search
              aria-hidden="true"
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              strokeWidth={1.8}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => reset(setQuery)(e.target.value)}
              aria-label="Search documents"
              placeholder="Search name, category, uploader..."
              className="border-line bg-surface text-ink placeholder:text-ink-subtle focus:border-brand-400 h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
            <SelectFilter
              label="Status"
              value={status}
              onChange={(v) => reset(setStatus)(v as StatusFilter)}
              options={statusOptions}
            />
            <SelectFilter
              label="Sort"
              value={sort}
              onChange={(v) => reset(setSort)(v as DocumentSort)}
              options={documentSortOptions}
            />
          </div>
        </div>

        <DocumentTable rows={pageRows} />

        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
          summary={
            rows.length === 0
              ? 'No documents to show'
              : `Showing ${from}-${to} of ${rows.length} documents`
          }
        />
      </section>

      <DocumentActivity documents={documents} />
    </div>
  )
}
