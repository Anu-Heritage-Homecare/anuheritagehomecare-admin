import { useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react'
import type { StaffMember } from './staff'
import { addDays, dayOf, formatDay, formatWeekRange, weekStart } from './schedule-data'
import {
  scheduleVisitStatus,
  useCaregiverSchedule,
  type CaregiverSchedule,
} from './useCaregiverSchedule'
import { Panel } from '@/components/ui/Panel'
import { VisitStatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Today, from the wall clock, as an ISO date. The backend drives the data. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ScheduleTab({
  member,
  suffix = '',
}: {
  member: StaffMember
  /** The roster's filters, so links out of here keep them. */
  suffix?: string
}) {
  const [params, setParams] = useSearchParams()

  /*
   * The visible week lives in the URL so a rota someone is looking at can be
   * shared. Anything that is not a Monday is snapped to one; an out of shape
   * value falls back to the current week.
   */
  const requested = params.get('week')
  const valid = requested && ISO.test(requested) && addDays(requested, 0) === requested
  const today = todayIso()
  const thisWeek = weekStart(today)
  const weekOf = valid ? requested : undefined

  const { data, isPending, isError, error, refetch } = useCaregiverSchedule(member.id, weekOf)

  const goTo = (next: string) => {
    const params2 = new URLSearchParams(params)
    if (next === thisWeek) params2.delete('week')
    else params2.set('week', next)
    setParams(params2)
  }

  if (isPending) {
    return (
      <p className="text-ink-subtle flex items-center justify-center gap-2 py-16 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading the schedule…
      </p>
    )
  }
  if (isError) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load the schedule.</p>
        <p className="text-ink-subtle text-sm">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  const start = data.weekStart
  const { summary, days, upcomingVisits, availabilitySettings } = data

  const tiles = [
    {
      id: 'hours',
      label: 'Hours scheduled',
      value:
        summary.targetHours === null
          ? `${summary.hoursScheduled}h`
          : `${summary.hoursScheduled}h of ${summary.targetHours}h`,
      hint:
        summary.loadPercent === null
          ? 'No contracted ceiling set'
          : `${summary.loadPercent}% of the ${summary.targetHours}h contract`,
      icon: Clock,
    },
    {
      id: 'visits',
      label: 'Visits scheduled',
      value: String(summary.visitsScheduled),
      hint: summary.allConfirmed ? 'All confirmed' : 'Some not yet confirmed',
      icon: CalendarDays,
    },
    {
      id: 'availability',
      label: 'Weekly availability',
      value: summary.availabilityDayRange ?? 'Not set',
      hint: summary.standardWindow ?? 'No standard window set',
      icon: Clock,
    },
  ]

  return (
    <div className="space-y-4">
      <section aria-labelledby="week-totals">
        <h2 id="week-totals" className="text-ink mb-3 text-base font-semibold tracking-tight">
          Week of {formatWeekRange(start)}
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
          {tiles.map(({ id, label, value, hint, icon: Icon }) => (
            <article key={id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
                  {label}
                </p>
                <Icon
                  className="text-ink-subtle size-4 shrink-0"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
              </div>
              <p className="text-ink mt-2 text-xl font-bold tracking-tight break-words tabular-nums">
                {value}
              </p>
              <p className="text-ink-subtle mt-1 text-xs break-words">{hint}</p>
            </article>
          ))}
        </div>
      </section>

      <Panel
        title="Weekly calendar"
        badge={
          <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
            {formatWeekRange(start)}
          </span>
        }
        flush
      >
        <nav aria-label="Change week" className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => goTo(addDays(start, -7))}
            className="border-line text-ink hover:bg-sunken inline-flex h-9 items-center gap-1 rounded-lg border pr-3 pl-2 text-sm font-medium"
          >
            <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
            Previous
            <span className="sr-only"> week</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (start === thisWeek) return
              goTo(thisWeek)
            }}
            aria-disabled={start === thisWeek}
            className={cn(
              'inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium',
              start === thisWeek
                ? 'border-line bg-sunken text-ink-subtle cursor-not-allowed'
                : 'border-line text-ink hover:bg-sunken',
            )}
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => goTo(addDays(start, 7))}
            className="border-line text-ink hover:bg-sunken inline-flex h-9 items-center gap-1 rounded-lg border pr-2 pl-3 text-sm font-medium"
          >
            Next
            <span className="sr-only"> week</span>
            <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </nav>

        {/* Seven columns cannot fit at 320, so the grid becomes a day list. */}
        <div
          tabIndex={0}
          role="region"
          aria-label={`Rota for ${formatWeekRange(start)}`}
          className="border-line hidden overflow-x-auto border-t xl:block"
        >
          <div className="grid min-w-4xl grid-cols-7 divide-x divide-[var(--color-line)]">
            {days.map((day) => (
              <DayColumn key={day.date} day={day} today={day.date === today} />
            ))}
          </div>
        </div>

        <ul className="divide-line border-line divide-y border-t xl:hidden">
          {days.map((day) => (
            <li key={day.date} className={cn('p-4', day.date === today && 'bg-brand-50')}>
              <p className="text-ink text-sm font-semibold">
                {day.dayLabel} {formatDay(day.date)}
                {day.date === today && (
                  <span className="text-brand-700 ml-2 text-xs font-semibold">Today</span>
                )}
              </p>
              {day.visits.length === 0 ? (
                <p className="text-ink-subtle mt-1 text-sm">Off duty</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {day.visits.map((visit, i) => (
                    <li key={`${visit.time}-${i}`}>
                      <VisitBlock visit={visit} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Upcoming visits" className="xl:col-span-2" flush>
          {upcomingVisits.length === 0 ? (
            <p className="text-ink-subtle border-line border-t px-4 py-8 text-center text-sm">
              Nothing scheduled after today.
            </p>
          ) : (
            <>
              <div
                tabIndex={0}
                role="region"
                aria-label="Upcoming visits table"
                className="hidden overflow-x-auto sm:block"
              >
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead className="border-line bg-sunken text-ink-muted border-y text-xs">
                    <tr>
                      {['Date', 'Time', 'Care recipient', 'Visit type', 'Duration', 'Status'].map(
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
                    {upcomingVisits.map((visit, i) => (
                      <tr key={`${visit.date}-${visit.time}-${i}`} className="hover:bg-canvas transition-colors">
                        <th scope="row" className="text-ink px-4 py-3 font-medium whitespace-nowrap">
                          {dayOf(visit.date)} {formatDay(visit.date)}
                        </th>
                        <td className="text-ink-muted px-4 py-3 whitespace-nowrap tabular-nums">
                          {visit.time}
                        </td>
                        <td className="text-ink-muted px-4 py-3 whitespace-nowrap">
                          {visit.recipientName}
                        </td>
                        <td className="text-ink-muted px-4 py-3">{visit.visitType}</td>
                        <td className="text-ink-muted px-4 py-3 tabular-nums">
                          {visit.durationHours}h
                        </td>
                        <td className="px-4 py-3">
                          <VisitStatusBadge status={scheduleVisitStatus(visit.status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-line border-line divide-y border-t sm:hidden">
                {upcomingVisits.map((visit, i) => (
                  <li key={`${visit.date}-${visit.time}-${i}`} className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-ink text-sm font-semibold">
                        {dayOf(visit.date)} {formatDay(visit.date)}
                      </p>
                      <VisitStatusBadge status={scheduleVisitStatus(visit.status)} />
                    </div>
                    <p className="text-ink-muted mt-1 text-sm break-words">
                      {visit.time} · {visit.recipientName} · {visit.visitType} ·{' '}
                      {visit.durationHours}h
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel
          title="Availability settings"
          action={{
            label: 'Edit availability',
            to: `/caregivers/${member.id}/edit${suffix}`,
          }}
        >
          <ul className="space-y-1.5">
            {availabilitySettings.days.map((day) => (
              <li key={day.dayLabel} className="flex items-center gap-3">
                <span className="text-ink-muted w-10 shrink-0 text-sm">{day.dayLabel}</span>
                <span
                  className={cn(
                    'min-w-0 flex-1 rounded-lg px-3 py-2 text-sm',
                    day.available ? 'bg-brand-50 text-brand-800' : 'bg-sunken text-ink-subtle',
                  )}
                >
                  {day.window ?? 'Off duty'}
                </span>
              </li>
            ))}
          </ul>

          <dl className="divide-line border-line mt-4 divide-y border-t pt-2">
            {[
              [
                'Contracted maximum',
                availabilitySettings.maxHoursPerWeek === null
                  ? 'Not set'
                  : `${availabilitySettings.maxHoursPerWeek}h`,
              ],
              ['Preferred shift', availabilitySettings.preferredShift ?? 'No preference'],
              ['Overtime', availabilitySettings.overtimeEligible ? 'Eligible' : 'Not eligible'],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-x-4 py-2 text-sm">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="text-ink font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  )
}

/* ---------------------------------- parts --------------------------------- */

type ScheduleDay = CaregiverSchedule['days'][number]
type ScheduleDayVisit = ScheduleDay['visits'][number]

function DayColumn({ day, today }: { day: ScheduleDay; today: boolean }) {
  return (
    <section
      aria-label={`${day.dayLabel} ${formatDay(day.date)}`}
      className={cn('min-w-0 p-2', today && 'bg-brand-50/60')}
    >
      <p className="text-ink-subtle px-1 text-xs font-semibold tracking-wider uppercase">
        {day.dayLabel}
      </p>
      <p className="text-ink px-1 text-sm font-semibold">
        {formatDay(day.date)}
        {today && <span className="text-brand-700 ml-1.5 text-xs font-semibold">Today</span>}
      </p>

      {day.visits.length === 0 ? (
        <p className="text-ink-subtle bg-sunken mt-2 rounded-lg px-2 py-3 text-center text-xs">
          Off duty
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {day.visits.map((visit, i) => (
            <li key={`${visit.time}-${i}`}>
              <VisitBlock visit={visit} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function VisitBlock({ visit, compact }: { visit: ScheduleDayVisit; compact?: boolean }) {
  return (
    <div className="border-brand-200 bg-brand-50/70 rounded-lg border p-2">
      <p className="text-ink text-xs font-semibold tabular-nums">
        {visit.time} – {visit.endTime}
      </p>
      <p className="text-ink mt-0.5 text-sm font-medium break-words">{visit.recipientName}</p>
      <p className="text-ink-muted text-xs break-words">{visit.visitType}</p>
      <div className={cn('mt-1.5', compact && 'origin-left scale-95')}>
        <VisitStatusBadge status={scheduleVisitStatus(visit.status)} />
      </div>
    </div>
  )
}
