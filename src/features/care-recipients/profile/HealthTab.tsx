import { Link, useOutletContext } from 'react-router-dom'
import { HeartPulse } from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import { getHealthRecord } from '../health-data'
import { HealthSummary } from './HealthSummary'
import { VitalsTrends } from './VitalsTrends'
import { HealthTimeline } from './HealthTimeline'

export function HealthTab() {
  const profile = useOutletContext<RecipientProfile>()
  const record = getHealthRecord(profile.id)

  if (!record) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <HeartPulse className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">
          No health record
        </h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          {profile.name} has no recorded vitals or health events yet. Trends and
          the event timeline appear here once readings are logged.
        </p>
        <Link
          to={`/care-recipients/${profile.id}/health/new`}
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Add Health Event
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <HealthSummary cards={record.summary} />
      <VitalsTrends vitals={record.vitals} />
      <HealthTimeline events={record.events} />
    </div>
  )
}
