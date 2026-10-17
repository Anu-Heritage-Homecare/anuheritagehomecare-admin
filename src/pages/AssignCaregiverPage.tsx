import { useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  ChevronDown,
  MapPin,
  Star,
  ChevronRight,
  BadgeCheck,
  Check,
  Info,
  Search,
  TriangleAlert,
} from 'lucide-react'
import {
  TODAY,
  applyQuery,
  availabilityOptions,
  RECOMMEND_THRESHOLD,
  bestMatch,
  branchesOnRoster,
  candidatesFor,
  formatTime,
  requirementFor,
  sortOptions,
  topRanked,
} from '@/features/scheduling/assign-data'
import type {
  AvailabilityFilter,
  Candidate,
  CandidateSort,
  CredentialFilter,
  Factor,
} from '@/features/scheduling/assign-data'
import { findVisit, formatFullDay } from '@/features/scheduling/visit-detail'
import type { BoardVisit } from '@/features/scheduling/board-data'
import { credentialStates } from '@/features/caregivers/roster-data'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'
import { formatMiles, travelMiles } from '@/features/monitoring/locations-data'
import { SelectBox } from '@/components/ui/SelectBox'

/* --------------------------------- helpers --------------------------------- */

function isAvailability(v: string): v is AvailabilityFilter {
  return availabilityOptions.some((o) => o.value === v)
}

function isSort(v: string): v is CandidateSort {
  return sortOptions.some((o) => o.value === v)
}

export function AssignCaregiverPage() {
  const { visitId } = useParams()
  const [params, setParams] = useSearchParams()
  // `findVisit`, not the full `contextFor` — the page only needs the visit,
  // and contextFor walks up to six weeks of the board on every keystroke.
  const visit = useMemo(() => findVisit(visitId), [visitId])

  const search = params.get('q') ?? ''
  // The Figma opens already narrowed: free at the visit time, holding the
  // service's certification. "all" is stored explicitly once cleared.
  const avail = params.get('avail') ?? 'covered'
  const cert = params.get('cert') ?? 'certified'
  const dist = params.get('dist') ?? 'any'
  const branch = params.get('branch') ?? 'all'
  const sort = params.get('sort') ?? 'match'

  const required = visit ? requirementFor(visit.type) : null

  // Memoised on the raw strings, not the object — a fresh object every render
  // would defeat the memos below it. Anything unrecognised falls back rather
  // than filtering everything out; a hand-edited link should not render an
  // empty page.
  const query = useMemo(
    () => ({
      search,
      availability: isAvailability(avail) ? avail : ('all' as AvailabilityFilter),
      // A certification filter on a service that requires none has no control
      // to represent it, so it is dropped rather than left silently active.
      credential: (required !== null && cert === 'certified'
        ? 'certified'
        : 'all') as CredentialFilter,
      branch: branchesOnRoster.includes(branch) ? branch : 'all',
      sort: isSort(sort) ? sort : ('match' as CandidateSort),
    }),
    [search, avail, cert, branch, sort, required],
  )

  const all = useMemo(() => (visit ? candidatesFor(visit) : []), [visit])
  const maxMiles = distanceOptions.find((d) => d.value === dist)?.miles ?? null
  const shown = useMemo(() => {
    const listed = applyQuery(all, query)
    if (maxMiles === null || !visit) return listed
    return listed.filter((c) => {
      const miles = travelMiles(c.member.id, visit.recipientId)
      return miles !== null && miles <= maxMiles
    })
  }, [all, query, maxMiles, visit])

  if (!visit) return <Navigate to="/scheduling" replace />

  // Nobody can be booked onto a visit that is already over.
  const closed =
    visit.date < TODAY ||
    visit.status === 'completed' ||
    visit.status === 'cancelled'

  const selectedId = params.get('selected')
  // Eligible only — a shared link naming a blocked caregiver must not open a
  // confirm bar for a booking the card says cannot be made.
  const selected =
    shown.find((c) => c.member.id === selectedId && c.eligible && !c.current) ??
    null
  const best = closed ? null : bestMatch(all)
  const top = closed ? null : topRanked(all)
  const filtered =
    query.search !== '' ||
    query.availability !== 'all' ||
    query.credential !== 'all' ||
    query.branch !== 'all' ||
    maxMiles !== null

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    const defaults: Record<string, string> = { avail: 'covered', cert: 'certified', dist: 'any' }
    const fallback = defaults[key] ?? 'all'
    if (value === '' || value === fallback) next.delete(key)
    else next.set(key, value)
    // Changing the filters must not leave a selection behind that is no longer
    // on screen — the confirm bar would describe an invisible card.
    if (key !== 'selected') next.delete('selected')
    setParams(next, { replace: true })
  }

  return (
    // The confirm bar is fixed; the pad keeps the last card and the escape
    // links clear of it. It wraps to several rows on a narrow screen.
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
              {/* An open visit is reached from the Unassigned queue; a
                  reassignment starts from the visit itself. */}
              {visit.caregiverId ? (
                <Link to={`/scheduling/visits/${visit.id}/overview`} className="hover:text-ink">
                  Visit Details
                </Link>
              ) : (
                <Link to="/scheduling?view=unassigned" className="hover:text-ink">
                  Unassigned Visits
                </Link>
              )}
            </li>
            <li aria-hidden="true">
              <ChevronRight className="text-ink-muted size-3.5" strokeWidth={2.4} />
            </li>
            <li className="text-brand-700 font-medium" aria-current="page">
              {visit.caregiverId ? 'Reassign Caregiver' : 'Assign Caregiver'}
            </li>
          </ol>
        </nav>

        <h1 className="text-ink mt-1.5 text-2xl font-bold tracking-tight">
          {visit.caregiverId ? 'Reassign Caregiver' : 'Assign Caregiver'}
        </h1>
        <p className="text-ink-muted mt-1 text-sm">
          Select the most suitable caregiver for this visit.
        </p>
        {closed && (
          <p className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <span>
              This visit is already over, so nobody can be booked onto it. The
              ranking below is shown for reference only.
            </span>
          </p>
        )}
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
              value={query.search}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Search caregivers by name, skill, or certification..."
              className="bg-sunken placeholder:text-ink-muted h-10 w-full rounded-lg pr-3 pl-10 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />
          </label>
          <ChipSelect
            boxed
            label="Sort by"
            value={query.sort}
            onChange={(v) => set('sort', v)}
            options={sortOptions.map((o) => ({ value: o.value, label: titleCase(o.label) }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ChipSelect
            label="Availability"
            value={query.availability}
            active={query.availability !== 'all'}
            onChange={(v) => set('avail', v)}
            options={availabilityOptions.map((o) => ({
              value: o.value,
              label: availabilityChipLabels[o.value],
            }))}
          />
          {required !== null && (
            <ChipSelect
              label="Certification"
              value={query.credential}
              active={query.credential !== 'all'}
              onChange={(v) => set('cert', v)}
              options={[
                { value: 'all', label: 'Any' },
                { value: 'certified', label: required },
              ]}
            />
          )}
          <ChipSelect
            label="Distance"
            value={maxMiles === null ? 'any' : dist}
            active={maxMiles !== null}
            onChange={(v) => set('dist', v)}
            options={distanceOptions.map((d) => ({ value: d.value, label: d.label }))}
          />
          <ChipSelect
            label="Branch"
            value={query.branch}
            active={query.branch !== 'all'}
            onChange={(v) => set('branch', v)}
            options={[
              { value: 'all', label: 'All' },
              ...branchesOnRoster.map((b) => ({ value: b, label: b })),
            ]}
          />
          <button
            type="button"
            aria-disabled={!filtered}
            onClick={() => {
              if (!filtered) return
              // Explicit "all": the defaults are themselves filters.
              setParams(new URLSearchParams({ avail: 'all', cert: 'all' }), { replace: true })
            }}
            className="text-brand-700 hover:text-brand-800 aria-disabled:text-ink-muted inline-flex min-h-8 items-center px-1 text-[0.8125rem] font-semibold underline underline-offset-2 aria-disabled:cursor-default aria-disabled:no-underline"
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
        {/* No badge on a weak top-of-list. Calling a 12-out-of-100 candidate
            the best match is worse than saying there isn't one. */}
        {!closed && best === null && top !== null && (
          <p className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <span>
              Nobody scores above {RECOMMEND_THRESHOLD} for this visit.{' '}
              {top.member.name} is the closest at {top.score}, but the gaps on
              their card need a coordinator&rsquo;s judgement.
            </span>
          </p>
        )}
        {!closed && top === null && shown.length > 0 && (
          <p className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <span>
              Nobody on the roster can take this visit. Every reason is on the
              cards below.
            </span>
          </p>
        )}
        {shown.length === 0 ? (
          <p className="text-ink-subtle card p-10 text-center text-sm">
            Nobody on the roster matches those filters.
          </p>
        ) : (
          <ul
            aria-label={`${shown.length} caregiver${shown.length === 1 ? '' : 's'}`}
            className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3"
          >
            {shown.map((candidate) => (
              <CandidateCard
                key={candidate.member.id}
                candidate={candidate}
                visit={visit}
                closed={closed}
                best={best?.member.id === candidate.member.id}
                selected={selected?.member.id === candidate.member.id}
                onSelect={() =>
                  set(
                    'selected',
                    selected?.member.id === candidate.member.id
                      ? ''
                      : candidate.member.id,
                  )
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
        {/* Backup coverage has nowhere to go yet, so this says so rather than
            sending a request that is never received. */}
        <button
          type="button"
          aria-disabled="true"
          className="text-brand-700 text-sm font-medium underline underline-offset-2 aria-disabled:cursor-default"
        >
          Can&rsquo;t find a match? Request backup coverage
        </button>
      </div>

      {selected && <ConfirmBar candidate={selected} visit={visit} onClear={() => set('selected', '')} />}
    </div>
  )
}

/* --------------------------------- filters -------------------------------- */

const availabilityChipLabels: Record<(typeof availabilityOptions)[number]['value'], string> = {
  all: 'All',
  eligible: 'Assignable',
  covered: 'Available at visit time',
}

const distanceOptions = [
  { value: 'any', label: 'Any', miles: null },
  { value: '3', label: 'Within 3 miles', miles: 3 },
  { value: '5', label: 'Within 5 miles', miles: 5 },
  { value: '10', label: 'Within 10 miles', miles: 10 },
] as const

function titleCase(label: string): string {
  return label.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * A native select drawn as the Figma's pill: "Label: Value". Outlined in brand
 * when it narrows the list, grey when it doesn't. `boxed` is the sort control's
 * squarer shape with a chevron.
 */
function ChipSelect({
  label,
  value,
  options,
  onChange,
  active = false,
  boxed = false,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
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
        onChange={(e) => onChange(e.target.value)}
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

const stripDate = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function VisitStrip({ visit }: { visit: BoardVisit }) {
  const address = getRecipientProfile(visit.recipientId)?.personal.address
  const facts = [
    { id: 'service', label: 'Service', value: visit.type },
    {
      id: 'date',
      label: 'Date',
      value: stripDate.format(new Date(`${visit.date}T00:00:00Z`)),
    },
    {
      id: 'time',
      label: 'Time',
      value: `${formatTime(visit.start)} (${visit.durationHours}h)`,
    },
    ...(address ? [{ id: 'location', label: 'Location', value: address }] : []),
    // Kept on a reassignment, so the incumbent is never mistaken for a fresh
    // recommendation.
    ...(visit.caregiverName
      ? [{ id: 'current', label: 'Currently assigned', value: visit.caregiverName }]
      : []),
  ]

  return (
    <section aria-labelledby="visit-strip" className="card p-4 sm:px-7 sm:py-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="visit-strip" className="text-ink text-lg font-bold tracking-tight break-words">
          <Link
            to={`/scheduling/visits/${visit.id}/overview`}
            className="hover:text-brand-700"
          >
            {visit.recipientName}
          </Link>
        </h2>
        <PriorityBadge priority={visit.priority} square />
      </div>
      <dl className="mt-1.5 flex flex-wrap gap-x-7 gap-y-1 text-sm">
        {facts.map((f) => (
          <div key={f.id} className="flex min-w-0 gap-1">
            <dt className="text-ink font-semibold">{f.label}:</dt>
            <dd className="text-ink-muted break-words">{f.value}</dd>
          </div>
        ))}
      </dl>
      {visit.recipientStatus !== 'active' && visit.type !== 'Onboarding visit' && (
        <p className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            strokeWidth={2.2}
            aria-hidden="true"
          />
          <span>
            {visit.recipientName} is not currently receiving care. Confirm with
            the coordinator before booking anyone onto this visit.
          </span>
        </p>
      )}
    </section>
  )
}

/* ------------------------------ candidate card ----------------------------- */

function CandidateCard({
  candidate,
  visit,
  closed,
  best,
  selected,
  onSelect,
}: {
  candidate: Candidate
  visit: BoardVisit
  closed: boolean
  best: boolean
  selected: boolean
  onSelect: () => void
}) {
  const { member, factors, eligible, current } = candidate
  const blockers = factors.filter((f) => f.weight === 'blocker')
  const cautions = factors.filter((f) => f.weight === 'caution')
  const headingId = `candidate-${member.id}`
  const miles = travelMiles(member.id, visit.recipientId)
  const muted = !eligible && !current

  // One line for where they stand at the visit's time: a clash outranks a
  // window, and a window that only partly covers the visit says so.
  const status = candidate.clash
    ? {
        dot: 'bg-red-400',
        text: `Busy ${formatTime(candidate.clash.start)} – ${formatTime(candidate.clash.end)}`,
      }
    : candidate.coverage === 'full' && candidate.window
      ? { dot: 'bg-brand-600', text: `Available from ${formatTime(candidate.window.start)}` }
      : candidate.coverage === 'partial' && candidate.window
        ? {
            dot: 'bg-amber-500',
            text: `Available ${formatTime(candidate.window.start)} – ${formatTime(candidate.window.end)} (partly)`,
          }
        : { dot: 'bg-ink-subtle', text: `Not available on ${visit.day}` }

  const outlined = best || selected

  return (
    <li>
      {/* An article, not a section — nine named regions on one page turns the
          landmark list into noise. */}
      <article
        aria-labelledby={headingId}
        className={cn(
          'card flex h-full flex-col p-5 transition-colors',
          outlined && 'border-brand-600 ring-brand-600 ring-1',
        )}
      >
        <div className={cn('flex flex-1 flex-col', muted && 'opacity-60')}>
          <div className="border-line/60 flex items-start gap-3 border-b pb-4">
            <Avatar name={member.name} decorative className="size-11 shrink-0 text-sm" />
            <div className="min-w-0 flex-1">
              <h3 id={headingId} className="text-ink text-base font-semibold break-words">
                <Link
                  to={`/caregivers/${member.id}/overview`}
                  className="hover:text-brand-700"
                >
                  {member.name}
                </Link>
              </h3>
              <p className="text-ink-muted text-sm break-words">{member.title}</p>
            </div>
            {current ? (
              <span className="bg-sunken text-ink shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold">
                On this visit
              </span>
            ) : (
              best && (
                <span className="bg-sunken text-ink shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold">
                  Best Match
                </span>
              )
            )}
          </div>

          <ul className="border-line/60 text-ink space-y-1.5 border-b py-4 text-sm">
            <li className="flex items-center gap-2.5">
              <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center">
                <span className={cn('size-2 rounded-full', status.dot)} />
              </span>
              <span className="min-w-0 break-words">{status.text}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin className="text-ink-subtle size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span>{miles === null ? 'Distance unknown' : `${formatMiles(miles)} away`}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CalendarDays className="text-ink-subtle size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span className="min-w-0 break-words">
                Load: {candidate.dayLoad} visit{candidate.dayLoad === 1 ? '' : 's'} that day ·{' '}
                {candidate.weekHours}h of {candidate.contractHours}h this week
              </span>
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

          <Credentials candidate={candidate} visit={visit} />

          {(blockers.length > 0 || cautions.length > 0) && (
            <ul className="mt-3 space-y-1.5">
              {[...blockers, ...cautions].map((factor) => (
                <FactorRow key={`${factor.weight}-${factor.id}`} factor={factor} />
              ))}
            </ul>
          )}

          <div className="mt-4 flex-1" />
        </div>

        {current ? (
          <p className="bg-sunken text-ink-muted inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold">
            Already on this visit
          </p>
        ) : closed ? (
          <p className="bg-sunken text-ink-muted inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold">
            The visit is over
          </p>
        ) : eligible ? (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={cn(
              'inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors',
              // Outlined when assigning them needs someone's sign-off.
              cautions.length > 0 && !selected
                ? 'border-brand-600 text-brand-700 hover:bg-brand-50 border'
                : 'bg-brand-600 hover:bg-brand-700 text-white',
            )}
          >
            {selected ? 'Selected' : 'Assign'}
            <span className="sr-only">
              {' '}
              {member.name}
              {cautions.length > 0 && ', needs sign-off'}
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

function Credentials({
  candidate,
  visit,
}: {
  candidate: Candidate
  visit: BoardVisit
}) {
  // Judged on the day of the visit when that is later than today — a card
  // expiring in August is fine for July and not for September.
  const states = credentialStates(
    candidate.member,
    visit.date > TODAY ? visit.date : TODAY,
  )
  const credentialNames = new Set(states.map((s) => s.credential.name.toLowerCase()))
  const skills = candidate.matchedSkills.filter((s) => !credentialNames.has(s.toLowerCase()))

  return (
    <div className="pt-4">
      <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">
        Certifications &amp; Skills
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {states.map(({ credential, state }) => (
          <li
            key={credential.id}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
              state === 'expired'
                ? 'bg-red-50 text-red-700'
                : state === 'expiring'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-sunken text-ink-muted',
            )}
          >
            {credential.name}
            {/* The word, not just the colour. */}
            {state === 'expired' ? (
              <span>(Expired)</span>
            ) : state === 'expiring' ? (
              <span>(Renewal due)</span>
            ) : (
              <Check className="size-3" strokeWidth={2.4} aria-label="valid" />
            )}
          </li>
        ))}
        {skills.map((skill) => (
          <li key={skill} className="bg-sunken text-ink-muted rounded-md px-2 py-0.5 text-xs">
            {skill}
          </li>
        ))}
      </ul>
    </div>
  )
}

const factorStyles: Record<Factor['weight'], string> = {
  blocker: 'text-red-700 bg-red-50',
  caution: 'text-amber-800 bg-amber-50',
  plus: 'text-emerald-800 bg-emerald-50',
}

function FactorRow({ factor }: { factor: Factor }) {
  return (
    <li
      title={factor.detail}
      className={cn(
        'flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium',
        factorStyles[factor.weight],
      )}
    >
      <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
      <span className="min-w-0 break-words">
        {factor.label}
        <span className="sr-only">. {factor.detail}</span>
      </span>
    </li>
  )
}

/* ------------------------------- confirm bar ------------------------------- */

function ConfirmBar({
  candidate,
  visit,
  onClear,
}: {
  candidate: Candidate
  visit: BoardVisit
  onClear: () => void
}) {
  const cautions = candidate.factors.filter((f) => f.weight === 'caution')

  return (
    <div
      role="region"
      aria-label="Confirm assignment"
      className="border-line bg-canvas fixed inset-x-0 bottom-0 z-20 border-t p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold break-words">
            {candidate.member.name} → {visit.recipientName},{' '}
            {formatTime(visit.start)}–{formatTime(visit.end)} on{' '}
            {formatFullDay(visit.date)}
          </p>
          {cautions.length > 0 ? (
            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-amber-900">
              <TriangleAlert
                className="mt-0.5 size-3.5 shrink-0"
                strokeWidth={2.4}
                aria-hidden="true"
              />
              <span className="break-words">
                Needs sign-off: {cautions.map((c) => c.label.toLowerCase()).join('; ')}.
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
            className="border-control text-ink hover:bg-sunken inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Change
          </button>
          {/* aria-disabled, not disabled — focusable and announced. Nothing
              writes back in the sample, and the note says so. */}
          <button
            type="button"
            aria-disabled="true"
            aria-describedby="confirm-note"
            className="bg-brand-600 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white aria-disabled:cursor-default aria-disabled:opacity-50"
          >
            <BadgeCheck className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Confirm assignment
          </button>
        </div>
      </div>
      <p id="confirm-note" className="text-ink-subtle mx-auto mt-2 max-w-6xl text-xs">
        Sample data — confirming does not write to the rota.
      </p>
    </div>
  )
}
