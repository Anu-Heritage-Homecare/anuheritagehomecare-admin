import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { PillBottle } from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import {
  getMedicationPlan,
  sortPrescriptions,
  type MedicationSort,
} from '../medications-data'
import { MedicationStats } from './MedicationStats'
import { MedicationList } from './MedicationList'
import {
  ClinicalWarnings,
  DoseSchedule,
  PrescriptionHistory,
} from './MedicationAside'

export function MedicationsTab() {
  const profile = useOutletContext<RecipientProfile>()
  const plan = getMedicationPlan(profile.id)
  const [sort, setSort] = useState<MedicationSort>('newest')

  const prescriptions = useMemo(
    () => sortPrescriptions(plan?.prescriptions ?? [], sort),
    [plan, sort],
  )

  if (!plan) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <PillBottle className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">
          No medications on file
        </h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          {profile.name} has no active prescriptions recorded. Dosing schedule
          and interaction warnings appear here once medications are added.
        </p>
        <Link
          to={`/care-recipients/${profile.id}/medications/new`}
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Add Medication
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <MedicationStats stats={plan.stats} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MedicationList
            prescriptions={prescriptions}
            sort={sort}
            onSortChange={setSort}
          />
        </div>

        {/* Two-up on tablet so the aside isn't a long thin column */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1 xl:content-start">
          <DoseSchedule date={plan.scheduleDate} doses={plan.doses} />
          <ClinicalWarnings warnings={plan.warnings} />
          <PrescriptionHistory audits={plan.audits} />
        </div>
      </div>
    </div>
  )
}
