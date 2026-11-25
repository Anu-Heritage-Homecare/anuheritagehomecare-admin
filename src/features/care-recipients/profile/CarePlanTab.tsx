import { Link, useOutletContext } from 'react-router-dom'
import { ClipboardList, Loader2 } from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import { useRecipientCarePlan } from '../useRecipientCarePlan'
import { CareGoals } from './CareGoals'
import { DailySchedule } from './DailySchedule'
import { CareInstructions } from './CareInstructions'
import { RevisionHistory } from './RevisionHistory'

export function CarePlanTab() {
  const profile = useOutletContext<RecipientProfile>()
  const { data: plan, isPending, isError, error, refetch } = useRecipientCarePlan(
    profile.id,
  )

  if (isPending) {
    return (
      <div className="card text-ink-subtle flex items-center justify-center gap-2 px-6 py-20 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading care plan…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <h2 className="text-ink text-sm font-semibold">Could not load care plan</h2>
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

  const empty =
    plan.goals.length === 0 &&
    plan.schedule.length === 0 &&
    plan.medicalNeeds.length === 0 &&
    plan.behavioural.length === 0

  if (empty) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <ClipboardList className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">
          No care plan on file
        </h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          {profile.name} doesn't have an active care plan yet. Goals, daily
          schedule and care instructions appear here once one is created.
        </p>
        <Link
          to={`/care-recipients/${profile.id}/care-plan/edit`}
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Create Care Plan
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <CareGoals goals={plan.goals} />
      <DailySchedule entries={plan.schedule} />
      <CareInstructions
        medicalNeeds={plan.medicalNeeds}
        behavioural={plan.behavioural}
      />
      <RevisionHistory revisions={plan.revisions} />
    </div>
  )
}
