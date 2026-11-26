import { useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Plus, TriangleAlert } from 'lucide-react'
import {
  ROSTER_PAGE_SIZE,
  age,
  assignmentsFor,
  complianceFor,
  complianceLabels,
  complianceTones,
  experienceYears,
  expiredCount,
  formatMonth,
  performanceFor,
  sortOptions,
  sortStaff,
  statusLabels,
  statusTones,
} from '@/features/caregivers/roster-data'
import type {
  StaffMember,
  StaffSort,
  StaffStatus,
} from '@/features/caregivers/roster-data'
import {
  useCaregiverProfile,
  useCaregiverRoster,
} from '@/features/caregivers/useCaregivers'
import { OverviewTab } from '@/features/caregivers/StaffTabs'
import { NotesTab } from '@/features/caregivers/NotesTab'
import { DocumentsTab } from '@/features/caregivers/DocumentsTab'
import { ScheduleTab } from '@/features/caregivers/ScheduleTab'
import { PerformanceTab } from '@/features/caregivers/PerformanceTab'
import { Panel } from '@/components/ui/Panel'
import { Pagination } from '@/components/ui/Pagination'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { Avatar } from '@/components/ui/Avatar'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'

const chip =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'

const tabs = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'schedule', label: 'Schedule' },
  { slug: 'performance', label: 'Performance' },
  { slug: 'documents', label: 'Documents' },
  { slug: 'notes', label: 'Notes' },
] as const

type TabSlug = (typeof tabs)[number]['slug']

function isTab(value: string | undefined): value is TabSlug {
  return tabs.some((t) => t.slug === value)
}

function isStatus(value: string | null): StaffStatus | 'all' {
  return value === 'active' || value === 'on-leave' || value === 'inactive'
    ? value
    : 'all'
}

export function CaregiversPage() {
  const { caregiverId, tab } = useParams()
  const [params, setParams] = useSearchParams()

  const query = params.get('q') ?? ''
  const status = isStatus(params.get('status'))
  const sort = (sortOptions.find((o) => o.value === params.get('sort'))?.value ??
    'name') as StaffSort
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1)

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  const roster = useCaregiverRoster()
  const members = useMemo(() => roster.data?.members ?? [], [roster.data])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = members.filter((s) => {
      if (status !== 'all' && s.status !== status) return false
      if (!needle) return true
      return (
        s.name.toLowerCase().includes(needle) ||
        s.ref.toLowerCase().includes(needle) ||
        s.title.toLowerCase().includes(needle) ||
        s.branch.toLowerCase().includes(needle) ||
        s.skills.some((k) => k.toLowerCase().includes(needle))
      )
    })
    return sortStaff(matched, sort)
  }, [members, query, status, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / ROSTER_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * ROSTER_PAGE_SIZE
  const rows = filtered.slice(start, start + ROSTER_PAGE_SIZE)

  const search = new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(sort !== 'name' ? { sort } : {}),
    ...(safePage > 1 ? { page: String(safePage) } : {}),
  }).toString()
  const suffix = search ? `?${search}` : ''

  // The profile is its own request; the roster rows carry only the table columns.
  if (caregiverId) {
    const all = params.toString()
    return (
      <StaffProfileLoader
        caregiverId={caregiverId}
        tab={tab}
        suffix={suffix}
        tabSuffix={all ? `?${all}` : ''}
      />
    )
  }

  const summary = {
    total: members.length,
    active: members.filter((s) => s.status === 'active').length,
    onLeave: members.filter((s) => s.status === 'on-leave').length,
    caregivers: members.filter((s) => s.title !== 'Care Coordinator').length,
    coordinators: members.filter((s) => s.title === 'Care Coordinator').length,
    // Compliance is read from each caregiver's credentials, which the directory
    // row does not carry; it is counted on the profile, not the roster.
    complianceIssues: 0,
  }
  const tiles: {
    id: string
    label: string
    value: number
    hint: string
    to?: string
  }[] = [
    {
      id: 'total',
      label: 'Staff',
      value: summary.total,
      hint: `${summary.caregivers} caregivers, ${summary.coordinators} coordinators`,
    },
    {
      id: 'active',
      label: 'Rostrable today',
      value: summary.active,
      hint: 'Active, and no lapsed credential',
    },
    { id: 'leave', label: 'On leave', value: summary.onLeave, hint: 'Not currently rostered' },
    {
      id: 'compliance',
      label: 'Compliance issues',
      value: summary.complianceIssues,
      hint: 'Expired or expiring credentials',
      to: '/caregivers?sort=compliance',
    },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">Caregivers</h1>
          <p className="text-ink-muted mt-1 text-sm">
            The staff roster: caseloads, credentials and availability.
            Assignments and performance are read back from the care records they
            work on, so both cover whatever the visit log holds.
          </p>
        </div>
        <Link
          to="/caregivers/new"
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white"
        >
          <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Add caregiver
        </Link>
      </header>

      <section aria-labelledby="roster-kpis">
        <h2 id="roster-kpis" className="sr-only">
          Roster totals
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => {
            const body = (
              <>
                <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
                  {t.label}
                </p>
                <p className="text-ink mt-2 text-2xl font-bold tracking-tight tabular-nums">
                  {t.value}
                </p>
                <p className="text-ink-subtle mt-1 text-xs break-words">{t.hint}</p>
              </>
            )
            // The compliance tile counts the whole roster, so it sorts the
            // table to show them rather than leaving the reader to hunt.
            return t.to ? (
              <Link
                key={t.id}
                to={t.to}
                className="card hover:border-brand-300 block p-4 transition-colors"
              >
                {body}
              </Link>
            ) : (
              <article key={t.id} className="card p-4">
                {body}
              </article>
            )
          })}
        </div>
      </section>

      <Panel title="Roster" flush>
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search caregivers</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search name, reference, role, branch or skill"
              className="border-line focus:border-brand-500 h-10 w-full min-w-40 rounded-lg border px-3 text-sm"
            />
          </label>
          <SelectFilter
            label="Status"
            value={status}
            onChange={(v) => setParam('status', v === 'all' ? null : v)}
            options={[
              { value: 'all', label: 'All statuses' },
              ...(Object.keys(statusLabels) as StaffStatus[]).map((s) => ({
                value: s,
                label: statusLabels[s],
              })),
            ]}
          />
          <SelectFilter
            label="Sort"
            value={sort}
            onChange={(v) => setParam('sort', v === 'name' ? null : v)}
            options={sortOptions}
          />
        </div>

        {roster.isPending ? (
          <p
            role="status"
            className="text-ink-subtle border-line flex items-center justify-center gap-2 border-t px-4 py-10 text-center text-sm"
          >
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            Loading the roster…
          </p>
        ) : roster.isError ? (
          <div className="border-line flex flex-col items-center gap-3 border-t px-4 py-10 text-center">
            <p className="text-ink text-sm font-medium">Could not load the roster.</p>
            <p className="text-ink-subtle text-sm">{roster.error.message}</p>
            <button
              type="button"
              onClick={() => void roster.refetch()}
              className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p
            role="status"
            className="text-ink-subtle border-line border-t px-4 py-10 text-center text-sm"
          >
            No caregivers match these filters.
          </p>
        ) : (
          <>
            <div
              tabIndex={0}
              role="region"
              aria-label="Caregiver roster table"
              className="hidden overflow-x-auto xl:block"
            >
              <table className="w-full min-w-4xl text-left text-sm">
                <thead className="border-line bg-sunken text-ink-muted border-y text-xs">
                  <tr>
                    {['Caregiver', 'Role', 'Branch', 'Caseload', 'Visits in log', 'Compliance', 'Status'].map(
                      (col) => (
                        <th
                          key={col}
                          scope="col"
                          className="px-4 py-2.5 font-semibold tracking-wide uppercase"
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {rows.map((s) => (
                    <StaffRow key={s.id} member={s} to={`/caregivers/${s.id}/overview${suffix}`} />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-line border-line divide-y border-t xl:hidden">
              {rows.map((s) => (
                <StaffCard key={s.id} member={s} to={`/caregivers/${s.id}/overview${suffix}`} />
              ))}
            </ul>

            <Pagination
              page={safePage}
              pageCount={pageCount}
              onPageChange={(next) =>
                setParam('page', next === 1 ? null : String(next))
              }
              summary={`Showing ${start + 1}–${start + rows.length} of ${filtered.length} caregivers`}
            />
          </>
        )}
      </Panel>
    </div>
  )
}

/* --------------------------------- profile -------------------------------- */

/** Fetches one caregiver's profile; the page owns the spinner and the error. */
function StaffProfileLoader({
  caregiverId,
  tab,
  suffix,
  tabSuffix,
}: {
  caregiverId: string
  tab: string | undefined
  suffix: string
  tabSuffix: string
}) {
  const { data: member, isPending, isError, error, refetch } = useCaregiverProfile(caregiverId)

  if (isPending) {
    return (
      <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading caregiver…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load this caregiver.</p>
        <p className="text-ink-subtle text-sm">{error.message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
          >
            Try again
          </button>
          <Link
            to={`/caregivers${suffix}`}
            className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Back to the roster
          </Link>
        </div>
      </div>
    )
  }

  // A missing or unknown tab resolves to Overview rather than blanking.
  if (!isTab(tab)) {
    return <Navigate to={`/caregivers/${member.id}/overview${suffix}`} replace />
  }

  return (
    <StaffProfile member={member} tab={tab} suffix={suffix} tabSuffix={tabSuffix} />
  )
}

function StaffProfile({
  member,
  tab,
  suffix,
  tabSuffix,
}: {
  member: StaffMember
  tab: TabSlug
  /** The roster's filters, carried through every link out of here. */
  suffix: string
  /** Every parameter, including whatever the open tab owns. */
  tabSuffix: string
}) {
  const compliance = complianceFor(member)
  const expired = expiredCount(member)

  return (
    <div className="space-y-6">
      <Link
        to={`/caregivers${suffix}`}
        className="text-ink-muted hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-sm"
      >
        <span aria-hidden="true">←</span> Back to the roster
      </Link>

      <div className="card px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-5">
            <Avatar
              name={member.name}
              decorative
              className="size-16 shrink-0 text-2xl"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-ink text-xl font-bold tracking-tight break-words">
                  {member.name}
                </h1>
                <span className="text-ink-subtle text-sm">{member.ref}</span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                    tonePill[statusTones[member.status]],
                  )}
                >
                  {statusLabels[member.status]}
                </span>
              </div>
              <p className="text-ink mt-1 text-sm break-words">{member.title}</p>
              {/* Experience is tenure plus what they brought with them, and
                  tenure comes from the hire date rather than a second stored
                  number that could disagree with it. */}
              <p className="text-ink-subtle mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                {[
                  `${experienceYears(member)} years experience`,
                  member.branch,
                  member.employment,
                  `Joined ${formatMonth(member.hiredAt)}`,
                ].map((part, i) => (
                  <span key={part} className="inline-flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true">•</span>}
                    {part}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to={`/caregivers/${member.id}/edit`}
              className="border-control text-ink hover:bg-sunken inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium"
            >
              Edit Profile
              <span className="sr-only"> for {member.name}</span>
            </Link>
            {/* The primary action follows the tab: the Figma puts Upload
                Document on Documents and Assign Visit everywhere else. */}
            {tab === 'documents' ? (
              <button
                type="button"
                className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white"
              >
                <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
                Upload Document
                <span className="sr-only"> for {member.name}</span>
              </button>
            ) : (
              // Assigning needs a visit, so this opens the queue of visits
              // that need a caregiver.
              <Link
                to="/scheduling?view=unassigned"
                className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-white"
              >
                Assign Visit
                <span className="sr-only"> to {member.name}</span>
              </Link>
            )}
            <span className="border-control inline-flex rounded-lg border">
              <DropdownMenu
                label={`More actions for ${member.name}`}
                items={[
                  { id: 'schedule', label: 'View schedule', to: `/caregivers/${member.id}/schedule${suffix}` },
                  { id: 'documents', label: 'View documents', to: `/caregivers/${member.id}/documents${suffix}` },
                  { id: 'roster', label: 'Back to the roster', to: `/caregivers${suffix}` },
                ]}
              />
            </span>
          </div>
        </div>

        {compliance === 'expired' && (
          <p className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <span>
              {expired} credential{expired === 1 ? ' has' : 's have'} expired.{' '}
              {member.name} should not be rostered until{' '}
              {expired === 1 ? 'it is' : 'they are'} renewed —{' '}
              <Link
                to={`/caregivers/${member.id}/documents${suffix}`}
                className="font-semibold underline"
              >
                see documents
              </Link>
              .
            </span>
          </p>
        )}

        <nav
          aria-label={`${member.name} record`}
          className="no-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto px-1 sm:-mx-6 sm:px-3"
        >
          {tabs.map((t) => {
            const selected = t.slug === tab
            return (
              <Link
                key={t.slug}
                to={`/caregivers/${member.id}/${t.slug}${tabSuffix}`}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors',
                  selected
                    ? 'border-brand-600 text-brand-700'
                    : 'text-ink hover:text-brand-700 border-transparent',
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {tab === 'overview' && <OverviewTab member={member} suffix={suffix} />}
      {tab === 'schedule' && <ScheduleTab member={member} suffix={suffix} />}
      {tab === 'performance' && <PerformanceTab member={member} />}
      {tab === 'documents' && <DocumentsTab member={member} />}
      {tab === 'notes' && <NotesTab member={member} suffix={suffix} />}
    </div>
  )
}

/* ---------------------------------- rows ---------------------------------- */

function StaffRow({ member, to }: { member: StaffMember; to: string }) {
  const caseload = assignmentsFor(member).length
  const performance = performanceFor(member)
  const compliance = complianceFor(member)

  return (
    <tr className="hover:bg-canvas transition-colors">
      <th scope="row" className="px-4 py-3 font-normal whitespace-nowrap">
        <span className="flex items-center gap-2.5">
          <Avatar name={member.name} decorative className="size-8 shrink-0 text-xs" />
          <span className="min-w-0">
            <Link to={to} className="text-ink hover:text-brand-700 font-medium">
              {member.name}
            </Link>
            <span className="text-ink-subtle block text-xs">
              {member.ref} · age {age(member)}
            </span>
          </span>
        </span>
      </th>
      <td className="text-ink-muted px-4 py-3 whitespace-nowrap">{member.title}</td>
      <td className="text-ink-muted px-4 py-3 whitespace-nowrap">
        {member.branch}
        <span className="text-ink-subtle block text-xs">{member.employment}</span>
      </td>
      <td className="text-ink-muted px-4 py-3 tabular-nums">
        {caseload === 0 ? (
          <span className="text-ink-subtle">None</span>
        ) : (
          `${caseload} client${caseload === 1 ? '' : 's'}`
        )}
      </td>
      <td className="text-ink-muted px-4 py-3 tabular-nums">
        {performance.logged === 0 ? (
          <span className="text-ink-subtle">None logged</span>
        ) : (
          `${performance.logged} · ${performance.hours}h`
        )}
      </td>
      <td className="px-4 py-3">
        <span className={cn(chip, tonePill[complianceTones[compliance]])}>
          {complianceLabels[compliance]}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn(chip, tonePill[statusTones[member.status]])}>
          {statusLabels[member.status]}
        </span>
      </td>
    </tr>
  )
}

function StaffCard({ member, to }: { member: StaffMember; to: string }) {
  const caseload = assignmentsFor(member).length
  const performance = performanceFor(member)
  const compliance = complianceFor(member)

  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={member.name} decorative className="size-9 shrink-0 text-xs" />
          <span className="min-w-0">
            <Link
              to={to}
              className="text-ink hover:text-brand-700 text-sm font-semibold break-words"
            >
              {member.name}
            </Link>
            <span className="text-ink-subtle block text-xs break-words">
              {member.ref} · {member.title}
            </span>
          </span>
        </span>
        <span className={cn(chip, tonePill[statusTones[member.status]])}>
          {statusLabels[member.status]}
        </span>
      </div>
      <p className="text-ink-muted mt-2 text-sm break-words">
        {member.branch} · {member.employment} ·{' '}
        {caseload === 0 ? 'no clients' : `${caseload} client${caseload === 1 ? '' : 's'}`}
        {performance.logged > 0 && ` · ${performance.logged} visits, ${performance.hours}h`}
      </p>
      <p className="mt-1">
        <span className={cn(chip, tonePill[complianceTones[compliance]])}>
          {complianceLabels[compliance]}
        </span>
      </p>
    </li>
  )
}
