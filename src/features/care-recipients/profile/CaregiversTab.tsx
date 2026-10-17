import { useOutletContext } from 'react-router-dom'
import { UserRoundX } from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import {
  calculateCoverage,
  getCaregiverRecord,
  totalHours,
} from '../caregivers-data'
import { CareTeamCards } from './CareTeamCards'
import { ScheduleCoverage } from './ScheduleCoverage'
import { AssignmentHistory } from './AssignmentHistory'
import { toneText } from '@/lib/tone'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types'

export function CaregiversTab() {
  const profile = useOutletContext<RecipientProfile>()
  const record = getCaregiverRecord(profile.id)

  if (!record) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <UserRoundX className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">
          No caregivers assigned
        </h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          {profile.name} has no assigned care team yet. Coverage and assignment
          history appear here once caregivers are attached.
        </p>
        <button
          type="button"
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Assign Caregiver
        </button>
      </div>
    )
  }

  const coverage = calculateCoverage(record.shifts, record.weekdays)
  const hours = totalHours(record.team)

  // Coverage tone tracks the number rather than being asserted alongside it.
  const coverageTone: Tone =
    coverage.percent === 100 ? 'green' : coverage.percent >= 80 ? 'amber' : 'red'

  const stats: {
    id: string
    label: string
    value: string
    meta: string
    metaTone: Tone
    hint: string
  }[] = [
    {
      id: 'assigned',
      label: 'Assigned Caregivers',
      value: String(record.team.length),
      meta: 'Stable',
      metaTone: 'slate',
      hint: 'Active members on primary team',
    },
    {
      id: 'hours',
      label: 'Total Care Hours (This Month)',
      value: `${hours}h`,
      meta: record.hoursDelta,
      metaTone: 'green',
      hint: 'Cumulative shift durations tracked',
    },
    {
      id: 'coverage',
      label: 'Coverage Rate',
      value: `${coverage.percent}%`,
      meta: `${coverage.covered} of ${coverage.total} blocks`,
      metaTone: coverageTone,
      // Which days are open is derived too — naming them in prose would go
      // stale the moment the grid changes.
      hint:
        coverage.openDays.length === 0
          ? 'All schedule blocks covered'
          : `Unassigned blocks on ${coverage.openDays.join(', ')}`,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map(({ id, label, value, meta, metaTone, hint }) => (
          <article key={id} className="card p-4">
            <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
              {label}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-ink text-3xl font-bold tracking-tight tabular-nums">
                {value}
              </p>
              <p className={cn('text-sm font-medium', toneText[metaTone])}>
                {meta}
              </p>
            </div>
            <p className="text-ink-subtle mt-1.5 text-xs">{hint}</p>
          </article>
        ))}
      </div>

      <CareTeamCards team={record.team} recipientId={profile.id} />
      <ScheduleCoverage shifts={record.shifts} weekdays={record.weekdays} />
      <AssignmentHistory history={record.history} />
    </div>
  )
}
