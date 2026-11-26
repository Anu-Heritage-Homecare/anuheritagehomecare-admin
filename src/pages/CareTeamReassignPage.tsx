import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { openRoles } from '@/features/care-recipients/caregivers-data'
import type { CaregiverRole, TeamMember } from '@/features/care-recipients/caregivers-data'
import { useRecipientCaregivers } from '@/features/care-recipients/useRecipientCaregivers'
import { useAssignableCaregivers } from '@/features/care-recipients/useAssignableCaregivers'
import type { AssignableCaregiver } from '@/features/care-recipients/useAssignableCaregivers'
import {
  useCareTeamWrites,
  type CareTeamRoleToken,
} from '@/features/care-recipients/useCareTeamWrites'
import { useReassignRecipientVisits } from '@/features/care-recipients/useReassignRecipientVisits'
import { useRecipientProfile } from '@/features/care-recipients/useRecipientProfile'
import type { RecipientProfile } from '@/features/care-recipients/profile-data'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { SelectBox } from '@/components/ui/SelectBox'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'

/*
 * Reassign a seat on a care recipient's team — or, with no seat named, assign
 * someone to a new one (the Caregivers tab's Assign Caregiver). Candidates are
 * the live caregiver directory (GET /admin/caregivers), whose ids are the
 * backend caregiver ids the assign write needs. Caregivers already on this
 * recipient's team are filtered out.
 *
 * Assigning writes POST /:id/caregivers. Reassigning additionally removes the
 * outgoing assignment (DELETE /:id/caregivers/:assignmentId) with the chosen
 * reason, so the seat changes hands in one confirm.
 *
 * Only the seats the backend models can be filled here: Primary, a supporting
 * Backup caregiver, and the Care Coordinator. The scored ranking and credential
 * detail of the earlier mock are not shown, because the directory list does not
 * carry skills, ratings, distance or credentials; nothing is invented.
 */

const reasons = [
  'Caregiver availability changed',
  'Family request',
  'Better skill match for current needs',
  'Workload balancing',
  'Caregiver leaving or on leave',
]

const sortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'branch', label: 'Branch' },
]

/** The display role of a seat to the backend CareTeamRole token it maps to. */
const ROLE_TOKEN: Partial<Record<CaregiverRole, CareTeamRoleToken>> = {
  'Primary Caregiver': 'PRIMARY',
  'Backup Caregiver': 'BACKUP',
  'Care Coordinator': 'COORDINATOR',
}

/** The seat being filled; `outgoing` is who holds it now, absent for a new seat. */
interface Seat {
  role: CaregiverRole
  outgoing?: TeamMember
}

export function CareTeamReassignPage() {
  const { id = '', memberId } = useParams()
  const [params] = useSearchParams()
  const back = id ? `/care-recipients/${id}/caregivers` : '/care-recipients'
  // The recipient header and the care team are both read from the backend; the
  // outgoing member carries the backend assignmentId the remove action needs.
  const { data: profile, isPending: profilePending } = useRecipientProfile(id)
  const { data: record, isPending, isError, error, refetch } = useRecipientCaregivers(id)

  if (isPending || profilePending) {
    return (
      <div className="card text-ink-subtle flex items-center justify-center gap-2 px-6 py-20 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading care team…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <h2 className="text-ink text-sm font-semibold">Could not load care team</h2>
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

  if (!profile) return <Navigate to={back} replace />

  const team = record.team

  if (memberId) {
    const member = team.find((m) => m.id === memberId)
    if (!member) return <Navigate to={back} replace />
    return (
      <ReassignView key={member.id} profile={profile} team={team} seat={{ role: member.role, outgoing: member }} />
    )
  }

  const roles = openRoles(id)
  const role = roles.find((r) => r === params.get('role')) ?? roles[0]
  return <ReassignView key={`assign-${role}`} profile={profile} team={team} seat={{ role }} roles={roles} />
}

function ReassignView({
  profile,
  team,
  seat,
  roles = [],
}: {
  profile: RecipientProfile
  team: TeamMember[]
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

  const roleToken = ROLE_TOKEN[seat.role]
  const { assign, remove } = useCareTeamWrites(profile.id)
  const reassignVisits = useReassignRecipientVisits(profile.id)
  const candidatesQuery = useAssignableCaregivers(roleToken !== undefined)
  // When reassigning a caregiver who holds upcoming visits, decide what happens
  // to those visits: move them to the incoming caregiver, release them, or leave.
  const [visitAction, setVisitAction] = useState<'move' | 'unassign' | 'leave'>('move')

  // Caregivers already holding a seat on this team are not offered again.
  const onTeam = useMemo(
    () => new Set(team.map((m) => m.name).filter((n) => n !== '—')),
    [team],
  )
  const all = useMemo(
    () => (candidatesQuery.data ?? []).filter((c) => !onTeam.has(c.name)),
    [candidatesQuery.data, onTeam],
  )
  const branches = useMemo(
    () => [...new Set(all.map((c) => c.branch).filter((b): b is string => b !== null))].sort(),
    [all],
  )

  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'name'
  const branch = params.get('branch') ?? 'all'

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = all.filter((c) => {
      if (branch !== 'all' && c.branch !== branch) return false
      if (!q) return true
      return [c.name, c.reference, c.title ?? '', c.branch ?? ''].join(' ').toLowerCase().includes(q)
    })
    const byName = (a: AssignableCaregiver, b: AssignableCaregiver) => a.name.localeCompare(b.name)
    return [...list].sort((a, b) =>
      sort === 'branch' ? (a.branch ?? '').localeCompare(b.branch ?? '') || byName(a, b) : byName(a, b),
    )
  }, [all, search, branch, sort])

  const selected = shown.find((c) => c.id === params.get('selected')) ?? null
  const filtered = search !== '' || branch !== 'all'

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    const fallback = key === 'sort' ? 'name' : 'all'
    if (value === '' || value === fallback) next.delete(key)
    else next.set(key, value)
    if (key !== 'selected') next.delete('selected')
    setParams(next, { replace: true })
  }

  const pending = assign.isPending || remove.isPending
  const writeError =
    assign.error instanceof ApiError
      ? assign.error.message
      : remove.error instanceof ApiError
        ? remove.error.message
        : null

  const confirm = (caregiver: AssignableCaregiver, reason: string): void => {
    if (roleToken === undefined) return
    assign.reset()
    remove.reset()
    assign.mutate(
      {
        caregiverId: caregiver.id,
        role: roleToken,
        scheduleLabel: member?.schedule,
        specialization: member?.specialization,
        reason: reason.trim() ? reason : undefined,
      },
      {
        onSuccess: () => {
          // Reassigning hands the seat over: drop the outgoing assignment too,
          // then move or release that caregiver's upcoming visits.
          if (member) {
            remove.mutate(
              { assignmentId: member.id, reason },
              { onSuccess: () => finishVisits(member, caregiver.id) },
            )
          } else {
            navigate(back)
          }
        },
      },
    )
  }

  const finishVisits = (outgoing: TeamMember, incomingCaregiverId: string): void => {
    if (outgoing.upcomingVisits > 0 && visitAction !== 'leave') {
      reassignVisits.mutate(
        {
          fromCaregiverId: outgoing.caregiverId,
          toCaregiverId: visitAction === 'move' ? incomingCaregiverId : undefined,
        },
        { onSuccess: () => navigate(back) },
      )
    } else {
      navigate(back)
    }
  }

  const facts = [
    { label: 'Seat', value: seat.role },
    ...(member
      ? [
          { label: 'Currently', value: member.name },
          { label: 'Schedule', value: member.schedule },
        ]
      : [{ label: 'Team size', value: `${team.length} people` }]),
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

      {assigning && !profile.hasCareSchedule && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={2.2} aria-hidden="true" />
          <p>
            {profile.name} has no active care plan on file yet. You can still assign a caregiver, but
            there is no recurring schedule to generate visits from until a care plan is set.
          </p>
        </div>
      )}

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

      {member && member.upcomingVisits > 0 && (
        <fieldset className="card p-4 sm:px-7 sm:py-5">
          <legend className="text-ink text-sm font-semibold">
            {member.name} has {member.upcomingVisits} upcoming visit
            {member.upcomingVisits === 1 ? '' : 's'}
          </legend>
          <p className="text-ink-muted mt-1 text-sm">
            Choose what happens to those scheduled visits when the seat changes hands.
          </p>
          <div className="mt-3 space-y-2">
            {[
              { value: 'move' as const, label: 'Move them to the new caregiver' },
              { value: 'unassign' as const, label: 'Unassign them (leave for the office to restaff)' },
              { value: 'leave' as const, label: `Leave them with ${member.name}` },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="visit-action"
                  checked={visitAction === opt.value}
                  onChange={() => setVisitAction(opt.value)}
                  className="size-4"
                />
                <span className="text-ink">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {roleToken === undefined ? (
        <p className="text-ink-muted card flex items-start gap-2 p-5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={2.2} aria-hidden="true" />
          <span>
            The {seat.role} seat cannot be filled from here. Only the Primary caregiver, a Backup
            caregiver and the Care Coordinator are supported by the care team service.
          </span>
        </p>
      ) : (
        <>
          <div className="card space-y-3 p-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative min-w-0 grow basis-64">
                <span className="sr-only">Search caregivers</span>
                <Search className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" strokeWidth={2} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => set('q', e.target.value)}
                  placeholder="Search caregivers by name, reference, title or branch..."
                  className="bg-sunken placeholder:text-ink-muted h-10 w-full rounded-lg pr-3 pl-10 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                />
              </label>
              <ChipSelect boxed label="Sort by" value={sort} onChange={(v) => set('sort', v)} options={sortOptions} />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {assigning && roles.length > 1 && (
                <ChipSelect
                  label="Role"
                  value={seat.role}
                  active
                  onChange={(v) => set('role', v)}
                  options={roles.map((r) => ({ value: r, label: r }))}
                />
              )}
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
                onClick={() => filtered && setParams(new URLSearchParams(sort === 'name' ? {} : { sort }), { replace: true })}
                className="text-brand-700 hover:text-brand-800 aria-disabled:text-ink-muted inline-flex min-h-8 items-center px-1 text-[0.8125rem] font-semibold underline underline-offset-2 aria-disabled:cursor-default aria-disabled:no-underline"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {writeError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {writeError}
            </p>
          )}

          <section aria-labelledby="candidates-heading">
            <h2 id="candidates-heading" className="sr-only">Candidates</h2>
            {candidatesQuery.isPending ? (
              <p className="text-ink-subtle card flex items-center justify-center gap-2 p-10 text-sm">
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Loading caregivers…
              </p>
            ) : candidatesQuery.isError ? (
              <div className="card grid place-items-center p-10 text-center">
                <p className="text-ink text-sm font-semibold">Could not load caregivers</p>
                <p className="text-ink-muted mt-1 text-sm">
                  {candidatesQuery.error instanceof ApiError
                    ? candidatesQuery.error.message
                    : 'The caregiver directory could not be loaded.'}
                </p>
                <button
                  type="button"
                  onClick={() => void candidatesQuery.refetch()}
                  className="bg-brand-600 hover:bg-brand-700 mt-4 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
                >
                  Try again
                </button>
              </div>
            ) : all.length === 0 ? (
              <p className="text-ink-subtle card p-10 text-center text-sm">
                Every active caregiver is already on {profile.name}&rsquo;s team.
              </p>
            ) : shown.length === 0 ? (
              <p className="text-ink-subtle card p-10 text-center text-sm">Nobody matches those filters.</p>
            ) : (
              <ul aria-label={`${shown.length} caregiver${shown.length === 1 ? '' : 's'}`} className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                {shown.map((c) => (
                  <CandidateCard
                    key={c.id}
                    candidate={c}
                    selected={selected?.id === c.id}
                    onSelect={() => set('selected', selected?.id === c.id ? '' : c.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

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
          pending={pending}
          onClear={() => set('selected', '')}
          onConfirm={(reason) => confirm(selected, reason)}
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
  selected,
  onSelect,
}: {
  candidate: AssignableCaregiver
  selected: boolean
  onSelect: () => void
}) {
  const headingId = `candidate-${candidate.id}`
  const subtitle = [candidate.title, candidate.branch].filter(Boolean).join(' · ')

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className={cn('card flex h-full flex-col p-5 transition-colors', selected && 'border-brand-600 ring-brand-600 ring-1')}
      >
        <div className="flex flex-1 flex-col">
          <div className="border-line/60 flex items-start gap-3 border-b pb-4">
            <Avatar name={candidate.name} decorative className="size-11 shrink-0 text-sm" />
            <div className="min-w-0 flex-1">
              <h3 id={headingId} className="text-ink text-base font-semibold break-words">
                <Link to={`/caregivers/${candidate.id}/overview`} className="hover:text-brand-700">{candidate.name}</Link>
              </h3>
              <p className="text-ink-muted text-sm break-words">{subtitle || 'No role recorded'}</p>
            </div>
            <span className="bg-sunken text-ink-muted shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums">
              {candidate.reference}
            </span>
          </div>
          <div className="flex-1" />
        </div>

        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="bg-brand-600 hover:bg-brand-700 mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition-colors"
        >
          {selected ? 'Selected' : 'Assign'}
          <span className="sr-only"> {candidate.name}</span>
        </button>
      </article>
    </li>
  )
}

function ConfirmBar({
  candidate,
  seat,
  profile,
  pending,
  onClear,
  onConfirm,
}: {
  candidate: AssignableCaregiver
  seat: Seat
  profile: RecipientProfile
  pending: boolean
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
              ? `${candidate.name} replaces ${member.name} as ${seat.role} for ${profile.name}`
              : `${candidate.name} joins ${profile.name}’s care team as ${seat.role}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="reassign-reason">Reason</label>
          <SelectBox
            id="reassign-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="border-control h-11 w-64 rounded-lg border px-3 text-sm"
          >
            <option value="">{member ? 'Reason for the change' : 'Reason (optional)'}</option>
            {reasons.map((r) => <option key={r}>{r}</option>)}
          </SelectBox>
          <button type="button" onClick={onClear} className="border-control text-ink hover:bg-sunken inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium">
            Change
          </button>
          <button
            type="button"
            disabled={(Boolean(member) && !reason) || pending}
            onClick={() => onConfirm(reason)}
            className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="size-4" strokeWidth={2.2} aria-hidden="true" />}
            {pending
              ? 'Working…'
              : member
                ? 'Confirm reassignment'
                : 'Confirm assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}
