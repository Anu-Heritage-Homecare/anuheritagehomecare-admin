import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, TriangleAlert } from 'lucide-react'
import {
  changedCount,
  defaultSettings,
  formatTime,
  hoursImpact,
  isDirty,
  nextOccurrence,
} from '@/features/scheduling/settings-data'
import type {
  DayHours,
  Holiday,
  HolidayPolicy,
  Impact,
  RuleId,
  ScheduleSettings,
} from '@/features/scheduling/settings-data'
import { Toggle } from '@/components/ui/Toggle'
import { fieldControl } from '@/lib/field-classes'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const dayNames: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
}

const policyOptions: HolidayPolicy[] = ['normal', 'emergency', 'closed']

/** The Figma's holidays, in its order, with its policies. */
const figmaHolidays: { id: string; policy: HolidayPolicy }[] = [
  { id: 'thanksgiving', policy: 'closed' },
  { id: 'christmas', policy: 'emergency' },
  { id: 'new-year', policy: 'emergency' },
  { id: 'mlk', policy: 'normal' },
]

/** The rules in the Figma's order and wording. */
const ruleRows: { id: RuleId; label: string }[] = [
  { id: 'certification-match', label: 'Require certification match for visit type' },
  { id: 'auto-assign-preferred', label: 'Auto-assign preferred caregiver' },
  { id: 'allow-overtime', label: 'Allow overtime scheduling' },
  { id: 'approve-urgent', label: 'Require coordinator approval for urgent visits' },
  { id: 'send-reminders', label: 'Send reminders 1 hour before visit' },
  { id: 'auto-cancel-unconfirmed', label: 'Auto-cancel unconfirmed visits after 24h' },
]

/** The services this screen configures, in the Figma's order and defaults. */
const serviceDurations: { type: string; hours: number; unit: 'hours' | 'minutes' }[] = [
  { type: 'Morning Care', hours: 2, unit: 'hours' },
  { type: 'Afternoon Care', hours: 3, unit: 'hours' },
  { type: 'Medication Administration', hours: 0.5, unit: 'minutes' },
  { type: 'Physical Therapy', hours: 1.5, unit: 'hours' },
  { type: 'Wound Care', hours: 1, unit: 'hours' },
  { type: 'Companionship', hours: 2, unit: 'hours' },
  { type: 'Clinical Checkup', hours: 1, unit: 'hours' },
]

/** A number box with its unit written inside it, as the Figma draws them. */
function UnitInput({
  id,
  unit,
  value,
  min,
  max,
  step,
  invalid = false,
  onChange,
}: {
  id: string
  unit: string
  value: number
  min: number
  max: number
  step: number
  invalid?: boolean
  onChange: (raw: string) => void
}) {
  return (
    <span
      className={cn(
        'border-control focus-within:border-brand-500 flex h-8 w-28 shrink-0 items-center rounded-lg border px-2.5',
        invalid && 'border-red-400',
      )}
    >
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-unit`}
        onChange={(e) => onChange(e.target.value)}
        className="text-ink min-w-0 flex-1 appearance-none bg-transparent text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span id={`${id}-unit`} className="text-ink-subtle shrink-0 text-xs">
        {unit}
      </span>
    </span>
  )
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

/** A cleared number input reads '', and Number('') is 0. */
function clamp(raw: string, min: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function ScheduleSettingsPage() {
  // The saved state and the working copy, held apart so "6 unsaved changes"
  // and Discard mean something exact rather than "the form has been touched".
  const initial = useMemo(() => {
    const base = defaultSettings()
    return {
      ...base,
      // The Figma ships with overtime off.
      rules: { ...base.rules, 'allow-overtime': false },
      buffer: { ...base.buffer, allowBackToBack: false },
      holidays: figmaHolidays.flatMap(({ id, policy }) => {
        const h = base.holidays.find((x) => x.id === id)
        return h ? [{ ...h, policy }] : []
      }),
      durations: Object.fromEntries(serviceDurations.map((d) => [d.type, d.hours])),
    }
  }, [])
  const [saved, setSaved] = useState<ScheduleSettings>(initial)
  const [draft, setDraft] = useState<ScheduleSettings>(initial)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const types = serviceDurations.map((d) => d.type)
  const dirty = isDirty(draft, saved)
  const changes = changedCount(draft, saved)

  // Save is not offered over a form that cannot be true: a day that closes
  // before it opens, or a service with no duration.
  const problems = [
    // A cleared <input type="time"> reads '', which compares below every clock
    // value — without this an empty opening time passed validation silently.
    ...draft.hours
      .filter((h) => h.open && (!h.start || !h.end))
      .map((h) => `${dayNames[h.day] ?? h.day} is missing an opening or closing time`),
    ...draft.hours
      .filter((h) => h.open && h.start && h.end && h.end <= h.start)
      .map((h) => `${dayNames[h.day] ?? h.day} closes before it opens`),
    ...types
      .filter((t) => !(draft.durations[t] > 0))
      .map((t) => `${t} has no duration`),
  ]
  const valid = problems.length === 0

  const outsideHours = useMemo(() => hoursImpact(draft.hours), [draft.hours])
  const patch = (next: Partial<ScheduleSettings>) =>
    setDraft((d) => ({ ...d, ...next }))

  const setDay = (day: string, next: Partial<DayHours>) =>
    patch({
      hours: draft.hours.map((h) => (h.day === day ? { ...h, ...next } : h)),
    })

  const actions = (
    <div className="flex shrink-0 flex-wrap items-center gap-2.5">
      {/* Cancel throws away the draft; with nothing to throw away it
          leaves the page. */}
      {dirty ? (
        <button
          type="button"
          onClick={() => setDraft(saved)}
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
        aria-disabled={!dirty || !valid}
        onClick={() => {
          if (!dirty || !valid) return
          setSaved(draft)
          setSavedAt(formatTime(nowClock()))
        }}
        className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-brand-600"
      >
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
          <h1 className="text-ink mt-1 text-2xl font-bold tracking-tight">
            Schedule Settings
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Configure scheduling rules, business hours, and visit preferences.
          </p>
          {/* Only when there is something to say: a problem that blocks
              saving, or confirmation that a save happened. */}
          {problems.length > 0 ? (
            <p role="status" className="mt-2 text-xs font-medium text-red-700">
              {problems[0]}
              {problems.length > 1 &&
                ` and ${problems.length - 1} other problem${problems.length === 2 ? '' : 's'}`}
              .
            </p>
          ) : dirty ? (
            <p role="status" className="text-ink-subtle mt-2 text-xs">
              {changes} unsaved change{changes === 1 ? '' : 's'} — settings last for
              this session only.
            </p>
          ) : (
            savedAt && (
              <p role="status" className="mt-2 text-xs font-medium text-emerald-700">
                Saved at {savedAt}
              </p>
            )
          )}
        </div>

        {actions}
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ----------------------------- business hours ---------------------- */}

        <div className="space-y-4">
          <section aria-labelledby="business-hours" className="card p-5">
            <div className="border-line/70 border-b pb-4">
              <h2 id="business-hours" className="text-ink text-base font-semibold tracking-tight">
                Business Hours
              </h2>
              <p className="text-ink-muted mt-0.5 text-xs">
                Define when visits can be scheduled.
              </p>
            </div>

            <ul className="mt-4 space-y-2">
              {draft.hours.map((h) => (
                <li
                  key={h.day}
                  className={cn('rounded-lg px-2 py-2', !h.open && 'bg-sunken')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Toggle
                      leading
                      tone="ink"
                      label={dayNames[h.day] ?? h.day}
                      checked={h.open}
                      onChange={(open) => setDay(h.day, { open })}
                      labelClassName={h.open ? 'font-semibold' : 'text-ink-subtle font-medium'}
                      className="min-w-32 grow"
                    />
                    {h.open ? (
                      <span className="flex shrink-0 items-center gap-2">
                        <label className="sr-only" htmlFor={`open-${h.day}`}>
                          {dayNames[h.day]} opening time
                        </label>
                        <input
                          id={`open-${h.day}`}
                          type="time"
                          value={h.start}
                          step={900}
                          onChange={(e) => setDay(h.day, { start: e.target.value })}
                          className={cn(fieldControl, 'w-28 text-sm')}
                        />
                        <span className="text-ink-subtle text-xs">to</span>
                        <label className="sr-only" htmlFor={`close-${h.day}`}>
                          {dayNames[h.day]} closing time
                        </label>
                        <input
                          id={`close-${h.day}`}
                          type="time"
                          value={h.end}
                          step={900}
                          onChange={(e) => setDay(h.day, { end: e.target.value })}
                          className={cn(fieldControl, 'w-28 text-sm')}
                        />
                      </span>
                    ) : (
                      <span className="text-ink-subtle shrink-0 pr-1 text-sm">Closed</span>
                    )}
                  </div>
                  {h.open && (!h.start || !h.end) && (
                    <p className="mt-1.5 text-xs font-medium text-red-700">
                      Both an opening and a closing time are required.
                    </p>
                  )}
                  {h.open && h.start && h.end && h.end <= h.start && (
                    <p className="mt-1.5 text-xs font-medium text-red-700">
                      Closing time must be after opening time.
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <ImpactNote
              impact={outsideHours}
              lead="visit"
              tail="already booked outside these hours"
            />
          </section>

          {/* ------------------------------- rules ---------------------------- */}

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
                    onChange={(next) => patch({ rules: { ...draft.rules, [id]: next } })}
                    className="items-center"
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ---------------------------- durations + buffer -------------------- */}

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
              {serviceDurations.map(({ type, unit }) => {
                const hours = draft.durations[type] ?? 0
                // Stored in hours; shown in the unit the service is thought of in.
                const shown = unit === 'minutes' ? Math.round(hours * 60) : hours
                const unitLabel = unit === 'minutes' ? 'minutes' : hours === 1 ? 'hour' : 'hours'
                const id = `duration-${slug(type)}`
                return (
                  <li key={type} className="flex items-center justify-between gap-3">
                    <label htmlFor={id} className="text-ink min-w-0 text-sm break-words">
                      {type}
                    </label>
                    <span
                      className={cn(
                        'border-control focus-within:border-brand-500 flex h-8 w-28 shrink-0 items-center rounded-lg border px-2.5',
                        !(hours > 0) && 'border-red-400',
                      )}
                    >
                      <input
                        id={id}
                        type="number"
                        min={unit === 'minutes' ? 5 : 0.25}
                        max={unit === 'minutes' ? 1440 : 24}
                        step={unit === 'minutes' ? 5 : 0.25}
                        value={shown}
                        aria-invalid={hours > 0 ? undefined : true}
                        aria-describedby={`${id}-unit`}
                        onChange={(e) => {
                          const next =
                            unit === 'minutes'
                              ? clamp(e.target.value, 0, 1440) / 60
                              : clamp(e.target.value, 0, 24)
                          patch({ durations: { ...draft.durations, [type]: next } })
                        }}
                        className="text-ink min-w-0 flex-1 appearance-none bg-transparent text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span id={`${id}-unit`} className="text-ink-subtle shrink-0 text-xs">
                        {unitLabel}
                      </span>
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
                  value={draft.buffer.minutes}
                  onChange={(raw) =>
                    patch({ buffer: { ...draft.buffer, minutes: clamp(raw, 0, 240) } })
                  }
                />
              </div>

              <Toggle
                label="Travel time estimation"
                checked={draft.buffer.estimateTravel}
                solidOff
                className="items-center"
                onChange={(estimateTravel) =>
                  patch({ buffer: { ...draft.buffer, estimateTravel } })
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
                  value={draft.buffer.maxTravelMiles}
                  onChange={(raw) =>
                    patch({ buffer: { ...draft.buffer, maxTravelMiles: clamp(raw, 1, 200) } })
                  }
                />
              </div>

              <Toggle
                label="Allow back-to-back visits"
                checked={draft.buffer.allowBackToBack}
                solidOff
                className="items-center"
                onChange={(allowBackToBack) =>
                  patch({ buffer: { ...draft.buffer, allowBackToBack } })
                }
              />
            </div>
          </section>

          {/* ------------------------------ holidays -------------------------- */}

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
              {draft.holidays.map((holiday) => (
                <HolidayRow
                  key={holiday.id}
                  holiday={holiday}
                  onChange={(policy) =>
                    patch({
                      holidays: draft.holidays.map((h) =>
                        h.id === holiday.id ? { ...h, policy } : h,
                      ),
                    })
                  }
                />
              ))}
            </ul>

            {/* Nothing adds a holiday yet, so it says so rather than doing nothing. */}
            <button
              type="button"
              aria-disabled="true"
              className="text-brand-600 mt-4 inline-flex items-center gap-2 px-1 text-sm font-medium aria-disabled:cursor-default"
            >
              <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
              Add Holiday
            </button>
          </section>
        </div>
      </div>

      <div className="border-line flex justify-end border-t pt-5">{actions}</div>
    </div>
  )
}

function nowClock(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* --------------------------------- pieces ---------------------------------- */


const holidayDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

const policyNotes: Record<HolidayPolicy, string> = {
  closed: 'No regular visits',
  emergency: 'Emergency only',
  normal: 'Normal operations',
}

const policyTags: Record<HolidayPolicy, { label: string; className: string }> = {
  closed: { label: 'Closed', className: 'bg-red-50 text-red-600' },
  emergency: { label: 'Emerg. Only', className: 'bg-[#fcf3cc] text-amber-600' },
  normal: { label: 'Open', className: 'bg-brand-50 text-brand-700' },
}

function HolidayRow({
  holiday,
  onChange,
}: {
  holiday: Holiday
  onChange: (policy: HolidayPolicy) => void
}) {
  // Computed from the holiday's rule, so the weekday and date always agree.
  const date = nextOccurrence(holiday)
  const id = `holiday-${holiday.id}`
  const tag = policyTags[holiday.policy]

  return (
    <li className="border-line flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-ink block text-sm font-semibold break-words">
          {holiday.name}
        </label>
        <p className="text-ink-subtle mt-0.5 text-xs break-words">
          {holidayDay.format(new Date(`${date}T00:00:00Z`))} • {policyNotes[holiday.policy]}
        </p>
      </div>
      {/* The tag is the control: a native select drawn as the Figma's badge. */}
      <SelectBox
        id={id}
        value={holiday.policy}
        onChange={(e) => onChange(e.target.value as HolidayPolicy)}
        className={cn(
          'shrink-0 cursor-pointer appearance-none rounded-md px-2.5 py-1 text-center text-xs font-semibold [field-sizing:content] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          tag.className,
        )}
      >
        {policyOptions.map((p) => (
          <option key={p} value={p}>
            {policyTags[p].label}
          </option>
        ))}
      </SelectBox>
    </li>
  )
}


function ImpactNote({
  id,
  impact,
  lead,
  plural,
  tail,
}: {
  id?: string
  impact: Impact
  lead: string
  plural?: string
  tail: string
}) {
  if (impact.count === 0) return null
  const noun = impact.count === 1 ? lead : (plural ?? `${lead}s`)

  return (
    <p
      id={id}
      className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
    >
      <TriangleAlert
        className="mt-0.5 size-3.5 shrink-0"
        strokeWidth={2.4}
        aria-hidden="true"
      />
      <span className="min-w-0 break-words">
        <span className="font-semibold">
          {impact.count} {noun} {tail}.
        </span>{' '}
        {impact.examples.join('; ')}
        {impact.count > impact.examples.length && ' and others'}.
      </span>
    </p>
  )
}
