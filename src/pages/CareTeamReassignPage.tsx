import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  MapPin,
  Search,
  Star,
  TriangleAlert,
} from 'lucide-react'
import {
  addTeamMember,
  getCaregiverRecord,
  openRoles,
  reassignTeamMember,
  replacementsFor,
} from '@/features/care-recipients/caregivers-data'
import type { CaregiverRole, TeamMember } from '@/features/care-recipients/caregivers-data'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import type { RecipientProfile } from '@/features/care-recipients/profile-data'
import { credentialStates, performanceFor } from '@/features/caregivers/roster-data'
import type { CredentialState } from '@/features/caregivers/roster-data'
import { staffByName } from '@/features/caregivers/staff'
import type { StaffMember } from '@/features/caregivers/staff'
import { formatMiles, travelMiles } from '@/features/monitoring/locations-data'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { SelectBox } from '@/components/ui/SelectBox'
import { TODAY } from '@/lib/today'
import { cn } from '@/lib/cn'

/*
 * Reassign a seat on a care recipient's team — or, with no seat named, assign
 * someone to a new one (the Caregivers tab's Assign Caregiver). Same layout as
 * the visit Reassign Caregiver page (header, summary strip, search and filter chips,
 * ranked candidate cards, a confirm bar), but for the standing seat rather
 * than one visit. Candidates are scored on what the seat needs: the outgoing
 * person's skills, client rating and distance to the recipient. A lapsed
 * credential makes someone ineligible.
 */

interface Candidate {
  member: StaffMember
  miles: number | null
  rating: number | null
  matched: string[]
  gaps: string[]
  credentials: CredentialState[]
  lapsed: CredentialState[]
  score: number
  eligible: boolean
}

const RECOMMEND_THRESHOLD = 60

const reasons = [
  'Caregiver availability changed',
  'Family request',
  'Better skill match for current needs',
  'Workload balancing',
  'Caregiver leaving or on leave',
]

const sortOptions = [
  { value: 'match', label: 'Best Match' },
  { value: 'distance', label: 'Nearest' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'name', label: 'Name' },
]
const distanceOptions = [
  { value: 'any', label: 'Any', miles: null },
  { value: '3', label: 'Within 3 miles', miles: 3 },
  { value: '5', label: 'Within 5 miles', miles: 5 },
  { value: '10', label: 'Within 10 miles', miles: 10 },
] as const
const skillOptions = [
  { value: 'all', label: 'Any' },
  { value: 'some', label: 'At least one' },
  { value: 'every', label: 'All of them' },
]

function wantedSkills(member: TeamMember): string[] {
  const own = staffByName(member.name)?.skills
  if (own && own.length > 0) return own
  return member.specialization.split(',').map((s) => s.trim()).filter((s) => s && s !== 'Not recorded')
}

/** The seat being filled; `outgoing` is who holds it now, absent for a new seat. */
interface Seat {
  role: CaregiverRole
  outgoing?: TeamMember
}

function buildCandidates(recipientId: string, seat: Seat): Candidate[] {
  // A new seat has nobody's skills to match, so it is scored on rating and
  // distance alone.
  const wanted = seat.outgoing ? wantedSkills(seat.outgoing) : []
  return replacementsFor(recipientId, seat).map((s) => {
    const have = new Set(s.skills.map((k) => k.toLowerCase()))
    const matched = wanted.filter((w) => have.has(w.toLowerCase()))
    const gaps = wanted.filter((w) => !have.has(w.toLowerCase()))
    const credentials = credentialStates(s, TODAY)
    const lapsed = credentials.filter((c) => c.state === 'expired')
    const miles = travelMiles(s.id, recipientId)
    const rating = performanceFor(s).rating
    // Each part counts only where there is something to measure, so an
    // unrated or unlocated caregiver is not scored down for it.
    const parts: [number, number][] = []
    if (wanted.length > 0) parts.push([matched.length / wanted.length, 50])
    if (rating !== null) parts.push([rating / 5, 30])
    if (miles !== null) parts.push([1 - Math.min(miles, 10) / 10, 20])
    const max = parts.reduce((t, [, w]) => t + w, 0)
    const score = max === 0 ? 0 : Math.round((parts.reduce((t, [v, w]) => t + v * w, 0) / max) * 100)
    return { member: s, miles, rating, matched, gaps, credentials, lapsed, score, eligible: lapsed.length === 0 }
  })
}

function availabilityText(member: StaffMember): string {
  const windows = member.availability
  if (windows.length === 0) return 'No availability set'
  return `Available ${windows.map((w) => w.day).join(', ')}`
}

export function CareTeamReassignPage() {
  const { id = '', memberId } = useParams()
  const [params] = useSearchParams()
  const profile = useMemo(() => getRecipientProfile(id), [id])
  const back = id ? `/care-recipients/${id}/caregivers` : '/care-recipients'
  if (!profile) return <Navigate to={back} replace />

  if (memberId) {
    const member = getCaregiverRecord(id)?.team.find((m) => m.id === memberId)
    if (!member) return <Navigate to={back} replace />
    return <ReassignView key={member.id} profile={profile} seat={{ role: member.role, outgoing: member }} />
  }

  const roles = openRoles(id)
  const role = roles.find((r) => r === params.get('role')) ?? roles[0]
  return <ReassignView key={`assign-${role}`} profile={profile} seat={{ role }} roles={roles} />
}

function ReassignView({
  profile,
  seat,
  roles = [],
}: {
  profile: RecipientProfile
  seat: Seat
  /** Assign mode only: the seats that can be filled. */
  roles?: CaregiverRole[]
}) {
  const member = seat.outgoing
  const assigning = !member
  const heading = assigning ? 'Assign Caregiver' : 'Reassign Caregiver'
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const back = `/care-recipients/${profile.id}/caregivers`

  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'match'
  const dist = params.get('dist') ?? 'any'
  const branch = params.get('branch') ?? 'all'
  const skills = params.get('skills') ?? 'all'

  const { role: seatRole } = seat
  const all = useMemo(() => buildCandidates(profile.id, { role: seatRole, outgoing: member }), [profile.id, seatRole, member])
  const branches = useMemo(() => [...new Set(all.map((c) => c.member.branch))].sort(), [all])
  const maxMiles = distanceOptions.find((d) => d.value === dist)?.miles ?? null

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = all.filter((c) => {
      if (branch !== 'all' && c.member.branch !== branch) return false
      if (maxMiles !== null && (c.miles === null || c.miles > maxMiles)) return false
      if (skills === 'some' && c.matched.length === 0) return false
      if (skills === 'every' && c.gaps.length > 0) return false
      if (!q) return true
      return [c.member.name, c.member.title, ...c.member.skills, ...c.credentials.map((s) => s.credential.name)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
    const byName = (a: Candidate, b: Candidate) => a.member.name.localeCompare(b.member.name)
    const eligibleFirst = (a: Candidate, b: Candidate) => Number(b.eligible) - Number(a.eligible)
    return list.sort((a, b) => {
      if (sort === 'name') return byName(a, b)
      if (sort === 'distance') return eligibleFirst(a, b) || (a.miles ?? Infinity) - (b.miles ?? Infinity) || byName(a, b)
      if (sort === 'rating') return eligibleFirst(a, b) || (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b)
      return eligibleFirst(a, b) || b.score - a.score || byName(a, b)
    })
  }, [all, search, branch, maxMiles, skills, sort])

  const top = [...all].filter((c) => c.eligible).sort((a, b) => b.score - a.score)[0] ?? null
  const best = top && top.score >= RECOMMEND_THRESHOLD ? top : null
  const selected = shown.find((c) => c.member.id === params.get('selected') && c.eligible) ?? null
  const filtered = search !== '' || branch !== 'all' || maxMiles !== null || skills !== 'all'

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    const fallback = key === 'sort' ? 'match' : key === 'dist' ? 'any' : 'all'
    if (value === '' || value === fallback) next.delete(key)
    else next.set(key, value)
    if (key !== 'selected') next.delete('selected')
    setParams(next, { replace: true })
  }

  const facts = [
    { label: 'Seat', value: seat.role },
    ...(member
      ? [
          { label: 'Currently', value: member.name },
          { label: 'Schedule', value: member.schedule },
        ]
      : [{ label: 'Team size', value: `${getCaregiverRecord(profile.id)?.team.length ?? 0} people` }]),
    { label: 'Care level', value: profile.careLevel },
    { label: 'Location', value: profile.personal.address },
  ]

  return (
    <div className="space-y-6 pb-56 sm:pb-32">
      <div className="card p-4 sm:px-7 sm:py-6">
        <nav aria-label="Breadcrumb">
          <ol className="text-ink-muted flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
            <li><Link to="/care-recipients" className="hover:text-ink">Care Recipients</Link></li>
            <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
            <li><Link to={back} className="hover:text-ink">{profile.name}</Link></li>
            <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
            <li className="text-brand-700 font-medium" aria-current="page">{heading}</li>
          </ol>
        </nav>
        <h1 className="text-ink mt-1.5 text-2xl font-bold tracking-tight">{heading}</h1>
        <p className="text-ink-muted mt-1 text-sm">
          {member
            ? `Select who should take over as ${seat.role} on ${profile.name}’s care team.`
            : `Select who should join ${profile.name}’s care team as ${seat.role}.`}
        </p>
      </div>

      <section aria-labelledby="seat-strip" className="card p-4 sm:px-7 sm:py-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="seat-strip" className="text-ink text-lg font-bold tracking-tight break-words">
            <Link to={back} className="hover:text-brand-700">{profile.name}</Link>
          </h2>
          <PriorityBadge priority={profile.priority} square />
        </div>
        <dl className="mt-1.5 flex flex-wrap gap-x-7 gap-y-1 text-sm">
          {facts.map((f) => (
            <div key={f.label} className="flex min-w-0 gap-1">
              <dt className="text-ink font-semibold">{f.label}:</dt>
              <dd className="text-ink-muted break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="card space-y-3 p-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 grow basis-64">
            <span className="sr-only">Search caregivers</span>
            <Search className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Search caregivers by name, skill, or certification..."
              className="bg-sunken placeholder:text-ink-muted h-10 w-full rounded-lg pr-3 pl-10 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />
          </label>
          <ChipSelect boxed label="Sort by" value={sort} onChange={(v) => set('sort', v)} options={sortOptions} />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {assigning && (
            <ChipSelect
              label="Role"
              value={seat.role}
              active
              onChange={(v) => set('role', v)}
              options={roles.map((r) => ({ value: r, label: r }))}
            />
          )}
          {!assigning && <ChipSelect label="Skills" value={skills} active={skills !== 'all'} onChange={(v) => set('skills', v)} options={skillOptions} />}
          <ChipSelect
            label="Distance"
            value={maxMiles === null ? 'any' : dist}
            active={maxMiles !== null}
            onChange={(v) => set('dist', v)}
            options={distanceOptions.map((d) => ({ value: d.value, label: d.label }))}
          />
          <ChipSelect
            label="Branch"
            value={branch}
            active={branch !== 'all'}
            onChange={(v) => set('branch', v)}
            options={[{ value: 'all', label: 'All' }, ...branches.map((b) => ({ value: b, label: b }))]}
          />
          <button
            type="button"
            aria-disabled={!filtered}
            onClick={() => filtered && setParams(new URLSearchParams(sort === 'match' ? {} : { sort }), { replace: true })}
            className="text-brand-700 hover:text-brand-800 aria-disabled:text-ink-muted inline-flex min-h-8 items-center px-1 text-[0.8125rem] font-semibold underline underline-offset-2 aria-disabled:cursor-default aria-disabled:no-underline"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <section aria-labelledby="candidates-heading">
        <h2 id="candidates-heading" className="sr-only">Candidates</h2>
        {all.length > 0 && best === null && top !== null && (
          <p className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <span>
              Nobody scores above {RECOMMEND_THRESHOLD} for this seat. {top.member.name} is the closest at {top.score}; the gaps on their card need a coordinator&rsquo;s judgement.
            </span>
          </p>
        )}
        {all.length === 0 ? (
          <p className="text-ink-subtle card p-10 text-center text-sm">
            Everyone suitable and active is already on {profile.name}&rsquo;s team.
          </p>
        ) : shown.length === 0 ? (
          <p className="text-ink-subtle card p-10 text-center text-sm">Nobody on the roster matches those filters.</p>
        ) : (
          <ul aria-label={`${shown.length} caregiver${shown.length === 1 ? '' : 's'}`} className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {shown.map((c) => (
              <CandidateCard
                key={c.member.id}
                candidate={c}
                best={best?.member.id === c.member.id}
                selected={selected?.member.id === c.member.id}
                onSelect={() => set('selected', selected?.member.id === c.member.id ? '' : c.member.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <Link to={back} className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-medium">
          Cancel
        </Link>
      </div>

      {selected && (
        <ConfirmBar
          candidate={selected}
          seat={seat}
          profile={profile}
          onClear={() => set('selected', '')}
          onConfirm={(reason) => {
            if (member) reassignTeamMember(profile.id, member.id, selected.member.name, reason)
            else addTeamMember(profile.id, selected.member.name, seat.role, reason)
            navigate(back)
          }}
        />
      )}
    </div>
  )
}

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
        boxed ? 'border-control text-ink hover:bg-sunken h-9 rounded-lg pl-3' : 'h-8 rounded-full pl-3',
        !boxed && (active ? 'border-brand-600 text-brand-700 font-semibold' : 'border-control text-ink-muted hover:bg-sunken'),
      )}
    >
      <span className="shrink-0">{label}:&nbsp;</span>
      <SelectBox
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-full min-w-0 cursor-pointer appearance-none bg-transparent focus:outline-none', boxed ? 'pr-8' : 'pr-3', active && 'font-semibold')}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </SelectBox>
      {boxed && <ChevronDown className="text-ink-muted pointer-events-none absolute right-2.5 size-4" strokeWidth={2.2} aria-hidden="true" />}
    </label>
  )
}

function CandidateCard({
  candidate,
  best,
  selected,
  onSelect,
}: {
  candidate: Candidate
  best: boolean
  selected: boolean
  onSelect: () => void
}) {
  const { member, miles, rating, matched, gaps, credentials, lapsed, eligible, score } = candidate
  const headingId = `candidate-${member.id}`
  const credentialNames = new Set(credentials.map((s) => s.credential.name.toLowerCase()))
  const skillChips = member.skills.filter((s) => !credentialNames.has(s.toLowerCase()))
  const matchedSet = new Set(matched.map((m) => m.toLowerCase()))

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className={cn('card flex h-full flex-col p-5 transition-colors', (best || selected) && 'border-brand-600 ring-brand-600 ring-1')}
      >
        <div className={cn('flex flex-1 flex-col', !eligible && 'opacity-60')}>
          <div className="border-line/60 flex items-start gap-3 border-b pb-4">
            <Avatar name={member.name} decorative className="size-11 shrink-0 text-sm" />
            <div className="min-w-0 flex-1">
              <h3 id={headingId} className="text-ink text-base font-semibold break-words">
                <Link to={`/caregivers/${member.id}/overview`} className="hover:text-brand-700">{member.name}</Link>
              </h3>
              <p className="text-ink-muted text-sm break-words">{member.title} · {member.branch}</p>
            </div>
            {best ? (
              <span className="bg-sunken text-ink shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold">Best Match</span>
            ) : (
              <span className="text-ink-subtle shrink-0 text-xs font-semibold tabular-nums">{score}/100</span>
            )}
          </div>

          <ul className="border-line/60 text-ink space-y-1.5 border-b py-4 text-sm">
            <li className="flex items-center gap-2.5">
              <CalendarDays className="text-ink-subtle size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span className="min-w-0 break-words">{availabilityText(member)}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin className="text-ink-subtle size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span>{miles === null ? 'Distance unknown' : `${formatMiles(miles)} away`}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Star className="size-4 shrink-0 text-amber-500" strokeWidth={1.9} aria-hidden="true" />
              {rating === null ? (
                <span className="text-ink-muted">Not yet rated</span>
              ) : (
                <span><span className="font-semibold">{rating.toFixed(1)}/5.0</span> <span className="text-ink-muted">(Rating)</span></span>
              )}
            </li>
          </ul>

          <div className="pt-4">
            <p className="text-ink-muted text-xs font-semibold tracking-wide uppercase">Certifications &amp; Skills</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {credentials.map(({ credential, state }) => (
                <li
                  key={credential.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                    state === 'expired' ? 'bg-red-50 text-red-700' : state === 'expiring' ? 'bg-amber-50 text-amber-800' : 'bg-sunken text-ink-muted',
                  )}
                >
                  {credential.name}
                  {state === 'expired' ? <span>(Expired)</span> : state === 'expiring' ? <span>(Renewal due)</span> : <Check className="size-3" strokeWidth={2.4} aria-label="valid" />}
                </li>
              ))}
              {skillChips.map((skill) => (
                <li
                  key={skill}
                  className={cn('rounded-md px-2 py-0.5 text-xs', matchedSet.has(skill.toLowerCase()) ? 'bg-emerald-50 text-emerald-800' : 'bg-sunken text-ink-muted')}
                >
                  {skill}
                </li>
              ))}
            </ul>
          </div>

          {(lapsed.length > 0 || gaps.length > 0) && (
            <ul className="mt-3 space-y-1.5">
              {lapsed.map((l) => (
                <li key={l.credential.id} className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                  <span>{l.credential.name} has lapsed</span>
                </li>
              ))}
              {gaps.length > 0 && (
                <li className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                  <span>Not listed: {gaps.join(', ')}</span>
                </li>
              )}
            </ul>
          )}

          <div className="mt-4 flex-1" />
        </div>

        {eligible ? (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={cn(
              'inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors',
              gaps.length > 0 && !selected
                ? 'border-brand-600 text-brand-700 hover:bg-brand-50 border'
                : 'bg-brand-600 hover:bg-brand-700 text-white',
            )}
          >
            {selected ? 'Selected' : 'Assign'}
            <span className="sr-only"> {member.name}</span>
          </button>
        ) : (
          <p className="bg-sunken text-ink-muted inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold opacity-70">Ineligible</p>
        )}
      </article>
    </li>
  )
}

function ConfirmBar({
  candidate,
  seat,
  profile,
  onClear,
  onConfirm,
}: {
  candidate: Candidate
  seat: Seat
  profile: RecipientProfile
  onClear: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const member = seat.outgoing

  return (
    <div role="region" aria-label={member ? 'Confirm reassignment' : 'Confirm assignment'} className="border-line bg-canvas fixed inset-x-0 bottom-0 z-20 border-t p-4 shadow-lg lg:left-[var(--spacing-sidebar)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold break-words">
            {member
              ? `${candidate.member.name} replaces ${member.name} as ${seat.role} for ${profile.name}`
              : `${candidate.member.name} joins ${profile.name}’s care team as ${seat.role}`}
          </p>
          {!member ? (
            <p className="text-ink-subtle mt-0.5 text-xs">Added to the team and recorded in the Assignment History.</p>
          ) : candidate.gaps.length > 0 ? (
            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-amber-900">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
              <span className="break-words">Check before confirming: {candidate.gaps.join(', ').toLowerCase()} not on their record.</span>
            </p>
          ) : (
            <p className="text-ink-subtle mt-0.5 text-xs">Covers every skill {member.name.split(' ')[0]} brought to the seat.</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="reassign-reason">Reason</label>
          <SelectBox
            id="reassign-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border-control h-11 w-64 rounded-lg border px-3 text-sm"
          >
            <option value="">Reason for the change</option>
            {reasons.map((r) => <option key={r}>{r}</option>)}
          </SelectBox>
          <button type="button" onClick={onClear} className="border-control text-ink hover:bg-sunken inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium">
            Change
          </button>
          <button
            type="button"
            disabled={!reason}
            onClick={() => onConfirm(reason)}
            className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white"
          >
            <BadgeCheck className="size-4" strokeWidth={2.2} aria-hidden="true" />
            {member ? 'Confirm reassignment' : 'Confirm assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}
