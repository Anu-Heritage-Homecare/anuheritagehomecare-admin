import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  useSchedulingSettings,
  useSchedulingSettingsMutations,
  type BusinessHourDay,
  type DefaultDuration,
  type SchedulingRules,
  type SchedulingSettingsView,
  type TravelSettings,
} from '@/features/scheduling/useSchedulingSettings'
import { Toggle } from '@/components/ui/Toggle'
import { fieldControl } from '@/lib/field-classes'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

/* Working copy held apart from the loaded data so "unsaved changes" and Cancel
   mean something exact. Business hours and durations use minutes from midnight /
   minutes; the form shows clocks and the service's natural unit. */

interface Draft {
  businessHours: BusinessHourDay[]
  defaultDurations: DefaultDuration[]
  rules: SchedulingRules
  travel: TravelSettings
}

function toDraft(data: SchedulingSettingsView): Draft {
  return {
    businessHours: data.businessHours.map((d) => ({ ...d })),
    defaultDurations: data.defaultDurations.map((d) => ({ ...d })),
    rules: { ...data.rules },
    travel: { ...data.travel },
  }
}

/** Minutes from midnight to a "HH:MM" value for a time input. */
function toClock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/** A "HH:MM" value to minutes from midnight. */
function toMinute(clock: string): number {
  const [h, m] = clock.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const ruleRows: { id: keyof SchedulingRules; label: string }[] = [
  { id: 'requireCertificationMatch', label: 'Require certification match for visit type' },
  { id: 'autoAssignPreferredCaregiver', label: 'Auto-assign preferred caregiver' },
  { id: 'allowOvertimeScheduling', label: 'Allow overtime scheduling' },
  { id: 'requireCoordinatorApprovalForUrgent', label: 'Require coordinator approval for urgent visits' },
  { id: 'sendRemindersOneHourBefore', label: 'Send reminders 1 hour before visit' },
  { id: 'autoCancelUnconfirmedAfter24h', label: 'Auto-cancel unconfirmed visits after 24h' },
]

const policyOptions = [
  { value: 'OPEN', label: 'Open' },
  { value: 'EMERGENCY_ONLY', label: 'Emerg. Only' },
  { value: 'CLOSED', label: 'Closed' },
]

const policyTags: Record<string, string> = {
  CLOSED: 'bg-red-50 text-red-600',
  EMERGENCY_ONLY: 'bg-[#fcf3cc] text-amber-600',
  OPEN: 'bg-brand-50 text-brand-700',
}

const holidayDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function ScheduleSettingsPage() {
  const settings = useSchedulingSettings()
  const { save, addHoliday, removeHoliday } = useSchedulingSettingsMutations()

  const loaded = settings.data
  // Seed the working copy from the loaded data; re-seed (during render, no
  // effect) whenever a fresh fetch replaces the data object.
  const [state, setState] = useState<{ source: SchedulingSettingsView; draft: Draft } | null>(null)
  if (loaded && state?.source !== loaded) {
    setState({ source: loaded, draft: toDraft(loaded) })
  }
  const draft = state?.draft ?? null
  const setDraft = (next: Draft | ((d: Draft) => Draft)) =>
    setState((s) =>
      s === null ? s : { source: s.source, draft: typeof next === 'function' ? next(s.draft) : next },
    )

  const baseline = useMemo(() => (loaded ? toDraft(loaded) : null), [loaded])
  const dirty = Boolean(draft && baseline && JSON.stringify(draft) !== JSON.stringify(baseline))

  if (settings.isPending || !draft) {
    return (
      <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading settings…
      </div>
    )
  }
  if (settings.isError) {
    return (
      <div className="card mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load Schedule Settings.</p>
        <p className="text-ink-subtle text-sm">{settings.error.message}</p>
        <button
          type="button"
          onClick={() => void settings.refetch()}
          className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  const problems = [
    ...draft.businessHours
      .filter((h) => h.open && h.closeMinute <= h.openMinute)
      .map((h) => `${h.weekdayLabel} closes before it opens`),
    ...draft.defaultDurations.filter((d) => d.minutes <= 0).map((d) => `${d.label} has no duration`),
  ]
  const valid = problems.length === 0

  const setDay = (weekday: string, next: Partial<BusinessHourDay>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            businessHours: d.businessHours.map((h) =>
              h.weekday === weekday ? { ...h, ...next } : h,
            ),
          }
        : d,
    )

  const setDuration = (visitType: string, minutes: number) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            defaultDurations: d.defaultDurations.map((x) =>
              x.visitType === visitType ? { ...x, minutes } : x,
            ),
          }
        : d,
    )

  const onSave = () => {
    if (!dirty || !valid) return
    save.mutate({
      businessHours: draft.businessHours.map((h) => ({
        weekday: h.weekday,
        open: h.open,
        openMinute: h.openMinute,
        closeMinute: h.closeMinute,
      })),
      defaultDurations: draft.defaultDurations.map((d) => ({
        visitType: d.visitType,
        minutes: d.minutes,
      })),
      rules: draft.rules,
      travel: draft.travel,
    })
  }

  const actions = (
    <div className="flex shrink-0 flex-wrap items-center gap-2.5">
      {dirty ? (
        <button
          type="button"
          onClick={() => setDraft(toDraft(loaded!))}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </button>
      ) : (
        <Link
          to="/scheduling"
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </Link>
      )}
      <button
        type="button"
        disabled={!dirty || !valid || save.isPending}
        onClick={onSave}
        className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:cursor-default disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
        Save Changes
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <header className="card flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb">
            <ol className="text-ink-subtle flex flex-wrap items-center gap-1.5 text-xs">
              <li>
                <Link to="/scheduling" className="hover:text-ink">
                  Scheduling
                </Link>
              </li>
              <li aria-hidden="true">&gt;</li>
              <li className="text-brand-700 font-medium" aria-current="page">
                Settings
              </li>
            </ol>
          </nav>
          <h1 className="text-ink mt-1 text-2xl font-bold tracking-tight">Schedule Settings</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Configure scheduling rules, business hours, and visit preferences.
          </p>
          {problems.length > 0 ? (
            <p role="status" className="mt-2 text-xs font-medium text-red-700">
              {problems[0]}
              {problems.length > 1 &&
                ` and ${problems.length - 1} other problem${problems.length === 2 ? '' : 's'}`}
              .
            </p>
          ) : save.isError ? (
            <p role="status" className="mt-2 text-xs font-medium text-red-700">
              {save.error.message}
            </p>
          ) : dirty ? (
            <p role="status" className="text-ink-subtle mt-2 text-xs">
              Unsaved changes.
            </p>
          ) : (
            save.isSuccess && (
              <p role="status" className="mt-2 text-xs font-medium text-emerald-700">
                Settings saved.
              </p>
            )
          )}
        </div>

        {actions}
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <section aria-labelledby="business-hours" className="card p-5">
            <div className="border-line/70 border-b pb-4">
              <h2 id="business-hours" className="text-ink text-base font-semibold tracking-tight">
                Business Hours
              </h2>
              <p className="text-ink-muted mt-0.5 text-xs">Define when visits can be scheduled.</p>
            </div>

            <ul className="mt-4 space-y-2">
              {draft.businessHours.map((h) => (
                <li
                  key={h.weekday}
                  className={cn('rounded-lg px-2 py-2', !h.open && 'bg-sunken')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Toggle
                      leading
                      tone="ink"
                      label={h.weekdayLabel}
                      checked={h.open}
                      onChange={(open) => setDay(h.weekday, { open })}
                      labelClassName={h.open ? 'font-semibold' : 'text-ink-subtle font-medium'}
                      className="min-w-32 grow"
                    />
                    {h.open ? (
                      <span className="flex shrink-0 items-center gap-2">
                        <label className="sr-only" htmlFor={`open-${h.weekday}`}>
                          {h.weekdayLabel} opening time
                        </label>
                        <input
                          id={`open-${h.weekday}`}
                          type="time"
                          value={toClock(h.openMinute)}
                          step={900}
                          onChange={(e) => setDay(h.weekday, { openMinute: toMinute(e.target.value) })}
                          className={cn(fieldControl, 'w-28 text-sm')}
                        />
                        <span className="text-ink-subtle text-xs">to</span>
                        <label className="sr-only" htmlFor={`close-${h.weekday}`}>
                          {h.weekdayLabel} closing time
                        </label>
                        <input
                          id={`close-${h.weekday}`}
                          type="time"
                          value={toClock(h.closeMinute)}
                          step={900}
                          onChange={(e) => setDay(h.weekday, { closeMinute: toMinute(e.target.value) })}
                          className={cn(fieldControl, 'w-28 text-sm')}
                        />
                      </span>
                    ) : (
                      <span className="text-ink-subtle shrink-0 pr-1 text-sm">Closed</span>
                    )}
                  </div>
                  {h.open && h.closeMinute <= h.openMinute && (
                    <p className="mt-1.5 text-xs font-medium text-red-700">
                      Closing time must be after opening time.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="scheduling-rules" className="card p-5">
            <div className="border-line/70 border-b pb-4">
              <h2 id="scheduling-rules" className="text-ink text-base font-semibold tracking-tight">
                Scheduling Rules
              </h2>
              <p className="text-ink-muted mt-0.5 text-xs">
                Automatic rules applied when creating schedules.
              </p>
            </div>

            <ul className="mt-4 space-y-4">
              {ruleRows.map(({ id, label }) => (
                <li key={id}>
                  <Toggle
                    label={label}
                    checked={draft.rules[id]}
                    solidOff
                    onChange={(next) =>
                      setDraft((d) => (d ? { ...d, rules: { ...d.rules, [id]: next } } : d))
                    }
                    className="items-center"
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section aria-labelledby="visit-durations" className="card p-5">
            <div className="border-line/70 border-b pb-4">
              <h2 id="visit-durations" className="text-ink text-base font-semibold tracking-tight">
                Default Visit Durations
              </h2>
              <p className="text-ink-muted mt-0.5 text-xs">
                Set default durations for each service type.
              </p>
            </div>

            <ul className="mt-4 space-y-2.5">
              {draft.defaultDurations.map((d) => {
                const id = `duration-${d.visitType}`
                return (
                  <li key={d.visitType} className="flex items-center justify-between gap-3">
                    <label htmlFor={id} className="text-ink min-w-0 text-sm break-words">
                      {d.label}
                    </label>
                    <span
                      className={cn(
                        'border-control focus-within:border-brand-500 flex h-8 w-28 shrink-0 items-center rounded-lg border px-2.5',
                        d.minutes <= 0 && 'border-red-400',
                      )}
                    >
                      <input
                        id={id}
                        type="number"
                        min={5}
                        max={1440}
                        step={5}
                        value={d.minutes}
                        aria-invalid={d.minutes > 0 ? undefined : true}
                        onChange={(e) =>
                          setDuration(d.visitType, Math.max(0, Math.min(1440, Number(e.target.value))))
                        }
                        className="text-ink min-w-0 flex-1 appearance-none bg-transparent text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-ink-subtle shrink-0 text-xs">minutes</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section aria-labelledby="travel-buffer" className="card p-5">
            <div className="border-line/70 border-b pb-4">
              <h2 id="travel-buffer" className="text-ink text-base font-semibold tracking-tight">
                Travel &amp; Buffer Settings
              </h2>
              <p className="text-ink-muted mt-0.5 text-xs">
                Configure time between consecutive visits.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="buffer-minutes" className="text-ink min-w-0 text-sm">
                  Minimum buffer between visits
                </label>
                <UnitInput
                  id="buffer-minutes"
                  unit="minutes"
                  min={0}
                  max={240}
                  step={5}
                  value={draft.travel.minBufferMinutes}
                  onChange={(n) =>
                    setDraft((d) =>
                      d ? { ...d, travel: { ...d.travel, minBufferMinutes: n } } : d,
                    )
                  }
                />
              </div>

              <Toggle
                label="Travel time estimation"
                checked={draft.travel.travelTimeEstimation}
                solidOff
                className="items-center"
                onChange={(travelTimeEstimation) =>
                  setDraft((d) => (d ? { ...d, travel: { ...d.travel, travelTimeEstimation } } : d))
                }
              />

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="max-miles" className="text-ink min-w-0 text-sm">
                  Maximum travel distance
                </label>
                <UnitInput
                  id="max-miles"
                  unit="miles"
                  min={1}
                  max={200}
                  step={1}
                  value={draft.travel.maxTravelDistanceMiles}
                  onChange={(n) =>
                    setDraft((d) =>
                      d ? { ...d, travel: { ...d.travel, maxTravelDistanceMiles: n } } : d,
                    )
                  }
                />
              </div>

              <Toggle
                label="Allow back-to-back visits"
                checked={draft.travel.allowBackToBackVisits}
                solidOff
                className="items-center"
                onChange={(allowBackToBackVisits) =>
                  setDraft((d) =>
                    d ? { ...d, travel: { ...d.travel, allowBackToBackVisits } } : d,
                  )
                }
              />
            </div>
          </section>

          <section aria-labelledby="holiday-calendar" className="card p-5">
            <div className="border-line/70 border-b pb-4">
              <h2 id="holiday-calendar" className="text-ink text-base font-semibold tracking-tight">
                Holiday Calendar
              </h2>
              <p className="text-ink-muted mt-0.5 text-xs">
                Visits on holidays require special approval.
              </p>
            </div>

            <ul className="mt-4 space-y-2.5">
              {loaded!.holidays.length === 0 && (
                <li className="text-ink-subtle text-sm">No holidays on the calendar.</li>
              )}
              {loaded!.holidays.map((holiday) => (
                <li
                  key={holiday.id}
                  className="border-line flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-ink block text-sm font-semibold break-words">{holiday.name}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs break-words">
                      {holidayDay.format(new Date(`${holiday.date.slice(0, 10)}T00:00:00Z`))} ·{' '}
                      {holiday.policyLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-semibold',
                        policyTags[holiday.policy] ?? 'bg-sunken text-ink-muted',
                      )}
                    >
                      {holiday.policyLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeHoliday.mutate(holiday.id)}
                      disabled={removeHoliday.isPending}
                      aria-label={`Remove ${holiday.name}`}
                      className="text-ink-muted hover:text-red-700 disabled:opacity-50"
                    >
                      <Trash2 className="size-4" strokeWidth={1.9} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <AddHolidayForm
              pending={addHoliday.isPending}
              error={addHoliday.isError ? addHoliday.error.message : null}
              onAdd={(input) => addHoliday.mutate(input)}
            />
          </section>
        </div>
      </div>

      <div className="border-line flex justify-end border-t pt-5">{actions}</div>
    </div>
  )
}

function UnitInput({
  id,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string
  unit: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <span className="border-control focus-within:border-brand-500 flex h-8 w-28 shrink-0 items-center rounded-lg border px-2.5">
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="text-ink min-w-0 flex-1 appearance-none bg-transparent text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-ink-subtle shrink-0 text-xs">{unit}</span>
    </span>
  )
}

function AddHolidayForm({
  pending,
  error,
  onAdd,
}: {
  pending: boolean
  error: string | null
  onAdd: (input: { name: string; date: string; policy: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [policy, setPolicy] = useState('OPEN')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-brand-600 hover:text-brand-700 mt-4 inline-flex items-center gap-2 px-1 text-sm font-medium"
      >
        <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
        Add Holiday
      </button>
    )
  }

  const valid = name.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date)

  return (
    <div className="border-line mt-4 space-y-2 rounded-lg border p-3">
      <input
        type="text"
        value={name}
        maxLength={200}
        onChange={(e) => setName(e.target.value)}
        placeholder="Holiday name"
        className={cn(fieldControl, 'text-sm')}
      />
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={cn(fieldControl, 'w-40 text-sm')}
        />
        <SelectBox value={policy} onChange={(e) => setPolicy(e.target.value)} className={cn(fieldControl, 'w-40 text-sm')}>
          {policyOptions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </SelectBox>
      </div>
      {error && <p className="text-xs font-medium text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid || pending}
          onClick={() =>
            onAdd({ name: name.trim(), date, policy })
          }
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setName('')
            setDate('')
          }}
          className="border-control text-ink hover:bg-sunken inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
