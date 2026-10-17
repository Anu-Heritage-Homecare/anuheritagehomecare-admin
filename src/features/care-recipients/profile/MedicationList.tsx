import { Clock, MoreHorizontal, TriangleAlert } from 'lucide-react'
import type { Prescription, MedicationSort } from '../medications-data'
import { ADHERENCE_THRESHOLD, sortOptions } from '../medications-data'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { cn } from '@/lib/cn'

function StatusChip({ status }: { status: Prescription['status'] }) {
  const styles = {
    active: 'bg-emerald-50 text-emerald-700',
    paused: 'bg-amber-50 text-amber-700',
    discontinued: 'bg-slate-100 text-slate-600',
  }[status]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
        styles,
      )}
    >
      {status}
    </span>
  )
}

function PrescriptionCard({ rx }: { rx: Prescription }) {
  const watch = rx.adherence !== null && rx.adherence < ADHERENCE_THRESHOLD

  return (
    <li className="border-line relative overflow-hidden rounded-xl border">
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          watch ? 'bg-amber-500' : 'bg-brand-600',
        )}
      />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-ink flex flex-wrap items-baseline gap-x-2 text-base font-semibold break-words">
              {rx.brand ? `${rx.name} (${rx.brand})` : rx.name}
              <span className="text-ink-subtle text-sm font-medium">
                {rx.strength}
              </span>
            </h3>
            <p className="text-ink-muted mt-0.5 text-sm break-words">
              Purpose: {rx.purpose}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <StatusChip status={rx.status} />
            <button
              type="button"
              aria-label={`Actions for ${rx.name}`}
              className="text-ink-subtle hover:bg-sunken hover:text-ink grid size-9 place-items-center rounded-lg"
            >
              <MoreHorizontal className="size-4.5" />
            </button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Schedule', value: rx.schedule },
            { label: 'Prescribed By', value: rx.prescribedBy },
            { label: 'Start Date', value: rx.startDateLabel },
          ].map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
                {label}
              </dt>
              <dd className="text-ink mt-1 text-sm break-words">{value}</dd>
            </div>
          ))}

          {/* dt/dd must be direct children of this div — a nested wrapper
              would leave the dl child with no term or definition at all. */}
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
            <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
              Adherence
            </dt>
            {rx.adherence === null ? (
              <dd className="text-ink-subtle basis-full pt-1 text-xs">No doses recorded yet</dd>
            ) : (
              <>
            <dd
              className={cn(
                'text-xs font-semibold tabular-nums',
                watch ? 'text-amber-700' : 'text-emerald-700',
              )}
            >
              {rx.adherence}%
            </dd>
            <dd className="mt-2 basis-full">
              <div
                role="progressbar"
                aria-valuenow={rx.adherence}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${rx.name} adherence`}
                className="bg-sunken h-1.5 w-full overflow-hidden rounded-full"
              >
                <div
                  className={cn(
                    'h-full rounded-full',
                    watch ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${rx.adherence}%` }}
                />
              </div>
            </dd>
              </>
            )}
          </div>
        </dl>
      </div>

      <div className="border-line bg-canvas flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 pl-5">
        <p className="text-ink-muted flex min-w-0 items-center gap-1.5 text-xs">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="break-words">
            Last administered:{' '}
            <span className="text-ink font-medium">{rx.lastAdministered}</span>
          </span>
        </p>

        {rx.flag && (
          <p className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{rx.flag}</span>
          </p>
        )}
      </div>
    </li>
  )
}

interface MedicationListProps {
  prescriptions: Prescription[]
  sort: MedicationSort
  onSortChange: (sort: MedicationSort) => void
}

export function MedicationList({
  prescriptions,
  sort,
  onSortChange,
}: MedicationListProps) {
  return (
    <section aria-labelledby="current-medications" className="card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="current-medications"
          className="text-ink text-base font-semibold tracking-tight"
        >
          Current Prescribed Medications
        </h2>
        <SelectFilter
          label="Sort"
          value={sort}
          onChange={(v) => onSortChange(v as MedicationSort)}
          options={sortOptions}
          // w-52 leaves ~124px for the option text; "Lowest Adherence" needs
          // more than that once a fallback font is in play.
          className="w-60"
        />
      </div>

      {prescriptions.length === 0 ? (
        <p className="text-ink-subtle py-10 text-center text-sm">
          No prescriptions on file.
        </p>
      ) : (
        <ul className="space-y-3">
          {prescriptions.map((rx) => (
            <PrescriptionCard key={rx.id} rx={rx} />
          ))}
        </ul>
      )}
    </section>
  )
}
