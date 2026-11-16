import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  MapPin,
  Search,
  Star,
  TriangleAlert,
} from 'lucide-react'
import {
  useAssignCandidates,
  type AssignCandidate,
  type CandidateSort,
} from '@/features/scheduling/useAssignCandidates'
import { useSchedulingMutations } from '@/features/scheduling/useSchedulingMutations'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'
import { toPriority } from '@/features/scheduling/useScheduling'

const sortOptions: { value: CandidateSort; label: string }[] = [
  { value: 'BEST_MATCH', label: 'Best match' },
  { value: 'DISTANCE', label: 'Nearest' },
  { value: 'RATING', label: 'Highest rated' },
]

function isSort(v: string): v is CandidateSort {
  return sortOptions.some((o) => o.value === v)
}

export function AssignCaregiverPage() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { assign } = useSchedulingMutations()

  const search = params.get('q') ?? ''
  const branch = params.get('branch') ?? 'all'
  const availableNow = params.get('avail') === 'now'
  const sort = isSort(params.get('sort') ?? '') ? (params.get('sort') as CandidateSort) : 'BEST_MATCH'

  const candidatesQuery = useAssignCandidates(visitId, {
    search: search || undefined,
    branch: branch === 'all' ? undefined : branch,
    availableNow,
    sort,
  })

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    if (key !== 'selected') next.delete('selected')
    setParams(next, { replace: true })
  }

  const selectedId = params.get('selected')

  if (candidatesQuery.isPending) {
    return (
      <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading candidates…
      </div>
    )
  }
  if (candidatesQuery.isError) {
    return (
      <div className="card mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load the Assign Caregiver screen.</p>
        <p className="text-ink-subtle text-sm">{candidatesQuery.error.message}</p>
        <button
          type="button"
          onClick={() => void candidatesQuery.refetch()}
          className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  const { visit, candidates } = candidatesQuery.data
  const branches = [...new Set(candidates.map((c) => c.branch).filter((b): b is string => !!b))].sort()
  const selected =
    candidates.find((c) => c.caregiverId === selectedId && c.eligibility.assignable) ?? null
  const best = candidates.find((c) => c.bestMatch) ?? null
  const anyAssignable = candidates.some((c) => c.eligibility.assignable)

  const onAssign = () => {
    if (!selected || !visitId) return
    assign.mutate(
      { id: visitId, caregiverId: selected.caregiverId },
      { onSuccess: () => navigate(`/scheduling/visits/${visitId}/overview`) },
    )
  }

  return (
    <div className="space-y-6 pb-56 sm:pb-32">
      <div className="card p-4 sm:px-7 sm:py-6">
        <nav aria-label="Breadcrumb">
          <ol className="text-ink-muted flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
            <li>
              <Link to="/scheduling" className="hover:text-ink">
                Scheduling
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="text-ink-muted size-3.5" strokeWidth={2.4} />
            </li>
            <li>
              <Link to={`/scheduling/visits/${visit.id}/overview`} className="hover:text-ink">
                Visit Details
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="text-ink-muted size-3.5" strokeWidth={2.4} />
            </li>
            <li className="text-brand-700 font-medium" aria-current="page">
              Assign Caregiver
            </li>
          </ol>
        </nav>

        <h1 className="text-ink mt-1.5 text-2xl font-bold tracking-tight">Assign Caregiver</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Select the most suitable caregiver for this visit.
        </p>
      </div>

      <VisitStrip visit={visit} />

      {/* -------------------------------- filters ------------------------------- */}

      <div className="card space-y-3 p-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 grow basis-64">
            <span className="sr-only">Search caregivers</span>
            <Search
              className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              type="search"
              defaultValue={search}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Search caregivers by name, skill, or certification..."
              className="bg-sunken placeholder:text-ink-muted h-10 w-full rounded-lg pr-3 pl-10 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />
          </label>
          <ChipSelect
            boxed
            label="Sort by"
            value={sort}
            onChange={(v) => set('sort', v)}
            options={sortOptions}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ChipSelect
            label="Availability"
            value={availableNow ? 'now' : 'all'}
            active={availableNow}
            onChange={(v) => set('avail', v)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'now', label: 'Available at visit time' },
            ]}
          />
          {branches.length > 0 && (
            <ChipSelect
              label="Branch"
              value={branch}
              active={branch !== 'all'}
              onChange={(v) => set('branch', v)}
              options={[{ value: 'all', label: 'All' }, ...branches.map((b) => ({ value: b, label: b }))]}
            />
          )}
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="text-brand-700 hover:text-brand-800 inline-flex min-h-8 items-center px-1 text-[0.8125rem] font-semibold underline underline-offset-2"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* ------------------------------- candidates ----------------------------- */}

      <section aria-labelledby="candidates-heading">
        <h2 id="candidates-heading" className="sr-only">
          Candidates
        </h2>
        {!anyAssignable && candidates.length > 0 && (
          <p className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <span>Nobody on the roster can take this visit. Every reason is on the cards below.</span>
          </p>
        )}
        {candidates.length === 0 ? (
          <p className="text-ink-subtle card p-10 text-center text-sm">
            Nobody on the roster matches those filters.
          </p>
        ) : (
          <ul
            aria-label={`${candidates.length} caregiver${candidates.length === 1 ? '' : 's'}`}
            className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3"
          >
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.caregiverId}
                candidate={candidate}
                best={best?.caregiverId === candidate.caregiverId}
                selected={selected?.caregiverId === candidate.caregiverId}
                onSelect={() =>
                  set('selected', selected?.caregiverId === candidate.caregiverId ? '' : candidate.caregiverId)
                }
              />
            ))}
          </ul>
        )}
      </section>

      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <Link
          to={`/scheduling/visits/${visit.id}/overview`}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>

      {selected && (
        <ConfirmBar
          candidate={selected}
          visit={visit}
          pending={assign.isPending}
          error={assign.isError ? assign.error.message : null}
          onClear={() => set('selected', '')}
          onConfirm={onAssign}
        />
      )}
    </div>
  )
}

/* --------------------------------- filters -------------------------------- */

function ChipSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  active = false,
  boxed = false,
}: {
  label: string
  value: string
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  active?: boolean
  boxed?: boolean
}) {
  return (
    <label
      className={cn(
        'relative inline-flex items-center border text-[0.8125rem] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
        boxed
          ? 'border-control text-ink hover:bg-sunken h-9 rounded-lg pl-3'
          : 'h-8 rounded-full pl-3',
        !boxed &&
          (active
            ? 'border-brand-600 text-brand-700 font-semibold'
            : 'border-control text-ink-muted hover:bg-sunken'),
      )}
    >
      <span className="shrink-0">{label}:&nbsp;</span>
      <SelectBox
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          'h-full min-w-0 cursor-pointer appearance-none bg-transparent [field-sizing:content] focus:outline-none',
          boxed ? 'pr-8' : 'pr-3',
          active && 'font-semibold',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectBox>
      {boxed && (
        <ChevronDown
          className="text-ink-muted pointer-events-none absolute right-2.5 size-4"
          strokeWidth={2.2}
          aria-hidden="true"
        />
      )}
    </label>
  )
}

/* ------------------------------- visit strip ------------------------------- */

type VisitHeader = ReturnType<typeof useAssignCandidates>['data'] extends infer T
  ? T extends { visit: infer V }
    ? V
    : never
  : never

function VisitStrip({ visit }: { visit: VisitHeader }) {
  const facts = [
    { id: 'service', label: 'Service', value: visit.serviceType },
    { id: 'date', label: 'Date', value: visit.date },
    { id: 'time', label: 'Time', value: `${visit.time} (${visit.durationHours}h)` },
    ...(visit.location ? [{ id: 'location', label: 'Location', value: visit.location }] : []),
  ]

  return (
    <section aria-labelledby="visit-strip" className="card p-4 sm:px-7 sm:py-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="visit-strip" className="text-ink text-lg font-bold tracking-tight break-words">
          <Link to={`/scheduling/visits/${visit.id}/overview`} className="hover:text-brand-700">
            {visit.recipientName}
          </Link>
        </h2>
        <PriorityBadge priority={toPriority(visit.priority)} square />
      </div>
      <dl className="mt-1.5 flex flex-wrap gap-x-7 gap-y-1 text-sm">
        {facts.map((f) => (
          <div key={f.id} className="flex min-w-0 gap-1">
            <dt className="text-ink font-semibold">{f.label}:</dt>
            <dd className="text-ink-muted break-words">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ------------------------------ candidate card ----------------------------- */

const availabilityDot: Record<AssignCandidate['availability']['status'], string> = {
  AVAILABLE: 'bg-brand-600',
  AVAILABLE_LATER: 'bg-amber-500',
  BUSY: 'bg-red-400',
  OFF_DUTY: 'bg-ink-subtle',
}

function CandidateCard({
  candidate,
  best,
  selected,
  onSelect,
}: {
  candidate: AssignCandidate
  best: boolean
  selected: boolean
  onSelect: () => void
}) {
  const headingId = `candidate-${candidate.caregiverId}`
  const assignable = candidate.eligibility.assignable
  const muted = !assignable
  const warn = candidate.eligibility.status === 'WARN'
  const outlined = best || selected

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className={cn(
          'card flex h-full flex-col p-5 transition-colors',
          outlined && 'border-brand-600 ring-brand-600 ring-1',
        )}
      >
        <div className={cn('flex flex-1 flex-col', muted && 'opacity-60')}>
          <div className="border-line/60 flex items-start gap-3 border-b pb-4">
            <Avatar name={candidate.name} decorative className="size-11 shrink-0 text-sm" />
            <div className="min-w-0 flex-1">
              <h3 id={headingId} className="text-ink text-base font-semibold break-words">
                <Link to={`/caregivers/${candidate.caregiverId}/overview`} className="hover:text-brand-700">
                  {candidate.name}
                </Link>
              </h3>
              <p className="text-ink-muted text-sm break-words">{candidate.title ?? '—'}</p>
            </div>
            {best && (
              <span className="bg-sunken text-ink shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold">
                Best Match
              </span>
            )}
          </div>

          <ul className="border-line/60 text-ink space-y-1.5 border-b py-4 text-sm">
            <li className="flex items-center gap-2.5">
              <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center">
                <span className={cn('size-2 rounded-full', availabilityDot[candidate.availability.status])} />
              </span>
              <span className="min-w-0 break-words">{candidate.availability.label}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin className="text-ink-subtle size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span>
                {candidate.distanceMiles === null
                  ? 'Distance unknown'
                  : `${candidate.distanceMiles.toFixed(1)} mi away`}
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <CalendarDays className="text-ink-subtle size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span className="min-w-0 break-words">{candidate.load.label}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Star className="size-4 shrink-0 text-amber-500" strokeWidth={1.9} aria-hidden="true" />
              {candidate.rating === null ? (
                <span className="text-ink-muted">Not yet rated</span>
              ) : (
                <span>
                  <span className="font-semibold">{candidate.rating.toFixed(1)}/5.0</span>{' '}
                  <span className="text-ink-muted">(Rating)</span>
                </span>
              )}
            </li>
          </ul>

          <div className="pt-4">
            <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
              Certifications &amp; Skills
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {candidate.certifications.map((c) => (
                <li
                  key={c.name}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                    c.valid ? 'bg-sunken text-ink-muted' : 'bg-red-50 text-red-700',
                  )}
                >
                  {c.name}
                  {c.valid ? (
                    <Check className="size-3" strokeWidth={2.4} aria-label="valid" />
                  ) : (
                    <span>(Expired)</span>
                  )}
                </li>
              ))}
              {candidate.skills.map((skill) => (
                <li key={skill} className="bg-sunken text-ink-muted rounded-md px-2 py-0.5 text-xs">
                  {skill}
                </li>
              ))}
            </ul>
          </div>

          {candidate.eligibility.reason && (
            <p
              className={cn(
                'mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium',
                assignable ? 'text-amber-800 bg-amber-50' : 'text-red-700 bg-red-50',
              )}
            >
              <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
              <span className="min-w-0 break-words">{candidate.eligibility.reason}</span>
            </p>
          )}

          <div className="mt-4 flex-1" />
        </div>

        {assignable ? (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={cn(
              'inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors',
              warn && !selected
                ? 'border-brand-600 text-brand-700 hover:bg-brand-50 border'
                : 'bg-brand-600 hover:bg-brand-700 text-white',
            )}
          >
            {selected ? 'Selected' : 'Assign'}
            <span className="sr-only">
              {' '}
              {candidate.name}
              {warn && ', needs sign-off'}
            </span>
          </button>
        ) : (
          <p className="bg-sunken text-ink-muted inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold opacity-70">
            Ineligible
          </p>
        )}
      </article>
    </li>
  )
}

/* ------------------------------- confirm bar ------------------------------- */

function ConfirmBar({
  candidate,
  visit,
  pending,
  error,
  onClear,
  onConfirm,
}: {
  candidate: AssignCandidate
  visit: VisitHeader
  pending: boolean
  error: string | null
  onClear: () => void
  onConfirm: () => void
}) {
  const warn = candidate.eligibility.status === 'WARN'

  return (
    <div
      role="region"
      aria-label="Confirm assignment"
      className="border-line bg-canvas fixed inset-x-0 bottom-0 z-20 border-t p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold break-words">
            {candidate.name} → {visit.recipientName}, {visit.time}–{visit.endTime} on {visit.date}
          </p>
          {error ? (
            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-red-700">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
              <span className="break-words">{error}</span>
            </p>
          ) : warn ? (
            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-amber-900">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
              <span className="break-words">
                Needs sign-off: {candidate.eligibility.reason ?? 'review before assigning'}.
              </span>
            </p>
          ) : (
            <p className="text-ink-subtle mt-0.5 flex items-start gap-1.5 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span>No warnings on this booking.</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className="border-control text-ink hover:bg-sunken inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <BadgeCheck className="size-4" strokeWidth={2.2} aria-hidden="true" />
            )}
            Confirm assignment
          </button>
        </div>
      </div>
    </div>
  )
}
