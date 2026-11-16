import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowUpDown,
  Columns3,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import {
  PAGE_SIZE,
  billingLabels,
  billingTones,
  formatActivity,
  shortStatus,
  statusLabels,
  statusTones,
  useBulkEditFamilies,
  useFamilies,
  useFamilyKpis,
  type AccountStatus,
  type FamilyAccount,
  type StatusFilter,
} from '@/features/families/useFamilies'
import { FamilyDetailPreview } from '@/features/families/FamilyDetailPreview'
import { Panel } from '@/components/ui/Panel'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { Drawer } from '@/components/ui/Drawer'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

const chip =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

const tabs: StatusFilter[] = ['all', 'active', 'inactive', 'pending']

const tabLabels: Record<StatusFilter, string> = {
  all: 'All',
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending verification',
}

function isStatus(value: string | null): StatusFilter {
  return value === 'active' || value === 'inactive' || value === 'pending' ? value : 'all'
}

type AccountSort = 'name' | 'activity' | 'unread'

const sortOptions: { value: AccountSort; label: string }[] = [
  { value: 'name', label: 'Name, A to Z' },
  { value: 'activity', label: 'Most recent activity' },
  { value: 'unread', label: 'Unanswered messages' },
]

/*
 * Search and sort are applied over the fetched page only: the backend paginates
 * and filters by status server side but has no search or sort parameter.
 * shortcut: in-page search/sort, upgrade when the list endpoint gains q and sort.
 */
function sortRows(rows: FamilyAccount[], order: AccountSort): FamilyAccount[] {
  const sorted = [...rows]
  if (order === 'activity')
    return sorted.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
  if (order === 'unread')
    return sorted.sort(
      (a, b) => b.unread - a.unread || b.lastActivity.localeCompare(a.lastActivity),
    )
  return sorted.sort((a, b) => a.name.localeCompare(b.name))
}

export function FamiliesPage() {
  const { accountId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const query = params.get('q') ?? ''
  const status = isStatus(params.get('status'))
  const sort = (sortOptions.find((o) => o.value === params.get('sort'))?.value ?? 'name') as AccountSort
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    // A status tab moves to the server, so it also resets to page one.
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  const kpis = useFamilyKpis()
  const { data, isPending, isError, error, refetch } = useFamilies({ status, page })
  const bulkEdit = useBulkEditFamilies()

  const rows = useMemo(() => {
    if (!data) return []
    const needle = query.trim().toLowerCase()
    const digits = needle.replace(/\D/g, '')
    const searched = needle
      ? data.rows.filter(
          (a) =>
            a.name.toLowerCase().includes(needle) ||
            a.ref.toLowerCase().includes(needle) ||
            a.email.toLowerCase().includes(needle) ||
            (digits.length > 0 && a.phone.replace(/\D/g, '').includes(digits)) ||
            a.linkedNames.some((n) => n.toLowerCase().includes(needle)),
        )
      : data.rows
    return sortRows(searched, sort)
  }, [data, query, sort])

  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE

  const search = new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(sort !== 'name' ? { sort } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  }).toString()
  const suffix = search ? `?${search}` : ''

  const [picked, setPicked] = useState<Set<string>>(new Set())
  const pageIds = rows.map((a) => a.id)
  const pickedOnPage = pageIds.filter((id) => picked.has(id)).length
  const allOnPagePicked = pageIds.length > 0 && pickedOnPage === pageIds.length

  const togglePick = (id: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const togglePage = () =>
    setPicked((current) => {
      const next = new Set(current)
      if (allOnPagePicked) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })

  const closeDrawer = () => navigate(`/families${suffix}`, { replace: true })

  const tiles: { id: string; label: string; value: number | string; hint: string }[] = [
    {
      id: 'total',
      label: 'Total families',
      value: kpis.data?.totalFamilies ?? '—',
      hint: 'Family member accounts',
    },
    {
      id: 'new',
      label: 'New families',
      value: kpis.data?.newFamilies ?? '—',
      hint: 'Recently added',
    },
    {
      id: 'primary',
      label: 'Primary contacts',
      value: kpis.data?.primaryContacts ?? '—',
      hint: 'One designated per household',
    },
    {
      id: 'care',
      label: 'With active care',
      value: kpis.data?.withActiveCare ?? '—',
      hint: 'Linked to an active recipient',
    },
    {
      id: 'billing',
      label: 'Billing overdue',
      value: kpis.data?.outstandingPayments ?? '—',
      hint: 'Of the contacts who are billed',
    },
    {
      id: 'pending',
      label: 'Pending requests',
      value: kpis.data?.pendingRequests ?? '—',
      hint: 'Awaiting the office',
    },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">Families</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Manage family accounts, communication, permissions, and linked care
            recipients.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Import', icon: Upload },
            { label: 'Export', icon: Download },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
            >
              <Icon className="size-4" strokeWidth={1.9} aria-hidden="true" />
              {label}
            </button>
          ))}
          <button
            type="button"
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white"
          >
            <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Add contact
          </button>
        </div>
      </header>

      <section aria-labelledby="family-kpis">
        <h2 id="family-kpis" className="sr-only">
          Directory totals
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {tiles.map((t) => (
            <article key={t.id} className="card p-4">
              <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
                {t.label}
              </p>
              <p className="text-ink mt-2 text-2xl font-bold tracking-tight tabular-nums">
                {t.value}
              </p>
              <p className="text-ink-subtle mt-1 text-xs break-words">{t.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <Panel title="Family contacts" flush>
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <div
            role="group"
            aria-label="Filter contacts by status"
            className="flex flex-wrap items-center gap-2"
          >
            {tabs.map((value) => {
              const active = status === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParam('status', value === 'all' ? null : value)}
                  className={cn(
                    'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-colors sm:min-h-9.5',
                    active ? 'bg-brand-600 text-white' : 'bg-sunken text-ink hover:bg-line',
                  )}
                >
                  {tabLabels[value]}
                </button>
              )
            })}
          </div>

          <label className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-32">
            <span className="sr-only">Search contacts</span>
            <Search
              aria-hidden="true"
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              strokeWidth={1.8}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search name, email, phone, recipient..."
              className="border-control focus:border-brand-500 h-11 w-full rounded-lg border pr-3 pl-8.5 text-sm sm:h-9.5"
            />
          </label>

          <button
            type="button"
            className="border-control text-ink hover:bg-sunken inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium sm:min-h-9.5"
          >
            <SlidersHorizontal
              className="size-4 shrink-0"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            Filters
          </button>
          <SelectFilter
            label="Sort"
            chip
            icon={ArrowUpDown}
            value={sort}
            onChange={(v) => setParam('sort', v === 'name' ? null : v)}
            options={sortOptions}
          />
          <button
            type="button"
            className="border-control text-ink hover:bg-sunken inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium sm:min-h-9.5"
          >
            <Columns3 className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            Columns
          </button>
        </div>

        {picked.size > 0 && (
          <div className="border-brand-300 bg-brand-50 mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
            <Tick
              checked
              label={`Clear ${picked.size} selected ${picked.size === 1 ? 'row' : 'rows'}`}
              onChange={() => setPicked(new Set())}
            />
            <span className="text-brand-800 text-sm font-semibold">
              {picked.size} {picked.size === 1 ? 'row' : 'rows'} selected
            </span>
            <span aria-hidden="true" className="bg-brand-300 h-4 w-px" />
            {[
              { label: 'Send message', icon: Send },
              { label: 'Export selected', icon: Download },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className="border-control bg-surface text-ink hover:bg-sunken inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium"
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                {label}
              </button>
            ))}
            {/* Bulk edit is wired: it sets the selected rows to one status. */}
            {(['active', 'inactive', 'pending'] as AccountStatus[]).map((option) => (
              <button
                key={option}
                type="button"
                disabled={bulkEdit.isPending}
                onClick={() =>
                  bulkEdit.mutate(
                    { ids: [...picked], status: option },
                    { onSuccess: () => setPicked(new Set()) },
                  )
                }
                className="border-control bg-surface text-ink hover:bg-sunken inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium disabled:opacity-50"
              >
                {bulkEdit.isPending ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Pencil className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                )}
                Set {statusLabels[option].toLowerCase()}
              </button>
            ))}
          </div>
        )}

        {isPending ? (
          <div className="text-ink-subtle border-line flex items-center justify-center gap-2 border-t py-20 text-sm">
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            Loading contacts…
          </div>
        ) : isError ? (
          <div className="border-line flex flex-col items-center gap-3 border-t p-10 text-center">
            <p className="text-ink text-sm font-medium">Could not load family contacts.</p>
            <p className="text-ink-subtle text-sm">{error.message}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p
            role="status"
            className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm"
          >
            No contacts match these filters.
          </p>
        ) : (
          <>
            <div
              tabIndex={0}
              role="region"
              aria-label="Family contacts table"
              className="hidden overflow-x-auto xl:block"
            >
              <table className="w-full min-w-4xl text-left text-sm">
                <thead className="border-line bg-sunken text-ink-muted border-y text-xs">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <Tick
                        checked={allOnPagePicked}
                        indeterminate={pickedOnPage > 0}
                        label="Select every contact on this page"
                        onChange={togglePage}
                      />
                    </th>
                    {[
                      'Family member',
                      'Relationship',
                      'Linked recipients',
                      'Phone',
                      'Billing',
                      'Last activity',
                      'Actions',
                    ].map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className={cn(
                          'px-3 py-2.5 font-semibold tracking-wide whitespace-nowrap uppercase',
                          col === 'Actions' && 'text-right',
                        )}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {rows.map((account) => (
                    <ContactRow
                      key={account.id}
                      account={account}
                      picked={picked.has(account.id)}
                      onPick={() => togglePick(account.id)}
                      selected={account.id === accountId}
                      to={`/families/${account.id}${suffix}`}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-line border-line divide-y border-t xl:hidden">
              {rows.map((account) => (
                <ContactCard
                  key={account.id}
                  account={account}
                  picked={picked.has(account.id)}
                  onPick={() => togglePick(account.id)}
                  selected={account.id === accountId}
                  to={`/families/${account.id}${suffix}`}
                />
              ))}
            </ul>

            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={(next) => setParam('page', next === 1 ? null : String(next))}
              summary={`Showing ${start + 1}–${start + rows.length} of ${total} contacts`}
            />
          </>
        )}
      </Panel>

      <p className="text-ink-subtle text-xs">
        One row per person, not per household — a contact acting for two
        recipients appears once, with both links. The per-recipient view lives
        on each{' '}
        <Link to="/care-recipients" className="text-brand-700">
          care record&rsquo;s Family tab
        </Link>
        .
      </p>

      <Drawer open={Boolean(accountId)} onClose={closeDrawer} title="Quick preview">
        {accountId && <FamilyDetailPreview id={accountId} />}
      </Drawer>
    </div>
  )
}

/* -------------------------------- selection -------------------------------- */

function Tick({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  label: string
  onChange: () => void
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate && !checked
      }}
      onChange={onChange}
      aria-label={label}
      className="accent-brand-600 border-control size-4 shrink-0 cursor-pointer rounded-sm"
    />
  )
}

/* ---------------------------------- rows ---------------------------------- */

function LinkedRecipients({ account }: { account: FamilyAccount }) {
  const names = account.linkedNames
  if (names.length === 0) return <span className="text-ink-subtle">—</span>
  if (names.length === 1)
    return <span className="text-ink-muted whitespace-nowrap">{names[0]}</span>

  const joined = names.join(', ')
  return (
    <span className="flex items-center gap-2">
      <span className="text-ink-muted whitespace-nowrap">{names.length} recipients</span>
      <span
        title={joined}
        className="bg-sunken text-ink-subtle max-w-36 truncate rounded-md px-1.5 py-0.5 text-xs"
      >
        {joined}
      </span>
    </span>
  )
}

function rowMenu(to: string): MenuItem[] {
  return [{ id: 'open', label: 'Open quick preview', to }]
}

function ContactRow({
  account,
  picked,
  onPick,
  selected,
  to,
}: {
  account: FamilyAccount
  picked: boolean
  onPick: () => void
  selected: boolean
  to: string
}) {
  return (
    <tr
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'transition-colors',
        selected
          ? 'bg-brand-50 [&>*:first-child]:border-brand-500 [&>*:first-child]:border-l-4'
          : 'hover:bg-canvas',
      )}
    >
      <td className="px-3 py-3">
        <Tick checked={picked} label={`Select ${account.name}`} onChange={onPick} />
      </td>
      <th scope="row" className="px-3 py-3 font-normal">
        <span className="flex items-center gap-2.5">
          <Avatar name={account.name} decorative className="size-8 shrink-0 text-xs" />
          <span className="min-w-0">
            <Link
              to={to}
              className="text-ink hover:text-brand-700 font-medium whitespace-nowrap"
            >
              {account.name}
            </Link>
            <span className="text-ink-subtle block text-xs whitespace-nowrap">
              {account.ref}
              {account.status !== 'active' && ` · ${shortStatus[account.status]}`}
            </span>
          </span>
        </span>
      </th>
      <td className="text-ink-muted px-3 py-3 whitespace-nowrap">
        {account.relationship ?? '—'}
      </td>
      <td className="px-3 py-3">
        <LinkedRecipients account={account} />
      </td>
      <td className="text-ink-muted px-3 py-3 whitespace-nowrap">{account.phone}</td>
      <td className="px-3 py-3">
        <span className={cn(chip, tonePill[billingTones[account.billing]])}>
          {billingLabels[account.billing]}
        </span>
      </td>
      <td className="text-ink-muted px-3 py-3 whitespace-nowrap">
        {formatActivity(account.lastActivity)}
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end">
          <DropdownMenu label={`Actions for ${account.name}`} items={rowMenu(to)} />
        </div>
      </td>
    </tr>
  )
}

function ContactCard({
  account,
  picked,
  onPick,
  selected,
  to,
}: {
  account: FamilyAccount
  picked: boolean
  onPick: () => void
  selected: boolean
  to: string
}) {
  return (
    <li
      aria-current={selected ? 'true' : undefined}
      className={cn('p-4', selected && 'border-brand-500 bg-brand-50 border-l-4 pl-3')}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <Tick checked={picked} label={`Select ${account.name}`} onChange={onPick} />
          <Avatar name={account.name} decorative className="size-9 shrink-0 text-xs" />
          <span className="min-w-0">
            <Link
              to={to}
              className="text-ink hover:text-brand-700 text-sm font-semibold break-words"
            >
              {account.name}
            </Link>
            <span className="text-ink-subtle block text-xs break-words">
              {account.ref}
              {account.relationship && ` · ${account.relationship}`}
            </span>
          </span>
        </span>
        <span className={cn(chip, tonePill[statusTones[account.status]])}>
          {statusLabels[account.status]}
        </span>
      </div>
      <p className="text-ink-muted mt-2 text-sm break-words">
        {account.linkedNames.length > 0 ? account.linkedNames.join(', ') : 'No recipients'} ·{' '}
        {account.phone}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className={cn(chip, tonePill[billingTones[account.billing]])}>
          {billingLabels[account.billing]}
        </span>
        <span className="text-ink-subtle">{formatActivity(account.lastActivity)}</span>
      </p>
    </li>
  )
}
