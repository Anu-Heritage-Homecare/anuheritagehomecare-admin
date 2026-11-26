import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import type { RecipientProfile } from '@/features/care-recipients/profile-data'
import { goalStatusLabels } from '@/features/care-recipients/care-plan-data'
import type {
  CareGoal,
  CarePlan,
  GoalStatus,
  Instruction,
  InstructionLevel,
  ScheduleEntry,
} from '@/features/care-recipients/care-plan-data'
import { useRecipientProfile } from '@/features/care-recipients/useRecipientProfile'
import { useRecipientCarePlan } from '@/features/care-recipients/useRecipientCarePlan'
import { useSaveCarePlan } from '@/features/care-recipients/useSaveCarePlan'
import { ApiError } from '@/lib/api'
import { fieldControl } from '@/lib/field-classes'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

/*
 * Edit (or create) a recipient's care plan. It edits exactly the sections the
 * Care Plan tab shows and the backend stores — goals (label, progress, status),
 * the daily schedule, and medical/behavioural instructions — and every save
 * records a revision through the care plan endpoints.
 */

const statuses = Object.keys(goalStatusLabels) as GoalStatus[]
const levels: { value: InstructionLevel; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'caution', label: 'Caution' },
  { value: 'critical', label: 'Critical' },
]

let seq = 0
const newId = (prefix: string) => `${prefix}-new-${(seq += 1)}`

/** "7:00 AM" → "07:00"; already 24-hour passes through. */
function to24(time: string): string {
  if (/^\d{2}:\d{2}$/.test(time)) return time
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  if (!m) return ''
  let h = Number(m[1]) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** "07:00" → 420 minutes from midnight. */
function toStartMinute(time24: string): number {
  const [h, m] = time24.split(':').map(Number)
  return h * 60 + m
}

export function CarePlanEditPage() {
  const { id = '' } = useParams()
  const recipient = useRecipientProfile(id)
  const plan = useRecipientCarePlan(id)

  if (recipient.isPending || plan.isPending) {
    return (
      <div className="card text-ink-subtle flex items-center justify-center gap-2 px-6 py-20 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading care plan…
      </div>
    )
  }

  if (recipient.isError || plan.isError || !recipient.data) {
    const message = recipient.error?.message ?? plan.error?.message ?? 'Care recipient not found'
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <p className="text-ink text-sm font-semibold">Could not load the care plan</p>
        <p className="text-ink-muted mt-1 text-sm">{message}</p>
        <Link
          to="/care-recipients"
          className="text-brand-700 mt-3 text-sm font-medium hover:underline"
        >
          Back to Care Recipients
        </Link>
      </div>
    )
  }

  return <PlanForm key={recipient.data.id} profile={recipient.data} existing={plan.data} />
}

function SectionCard({
  title,
  description,
  addLabel,
  onAdd,
  children,
}: {
  title: string
  description: string
  addLabel: string
  onAdd: () => void
  children: React.ReactNode
}) {
  const headingId = `plan-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={headingId} className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-ink text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-ink-muted mt-0.5 text-sm">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="border-control text-ink hover:bg-sunken inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
        >
          <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
          {addLabel}
        </button>
      </div>
      {children}
    </section>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-ink-subtle grid size-9 shrink-0 place-items-center rounded-lg hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
    </button>
  )
}

function Labelled({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="text-ink-muted mb-1.5 block text-xs font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  )
}

const empty = (text: string) => <p className="text-ink-muted border-line rounded-lg border border-dashed px-4 py-6 text-center text-sm">{text}</p>

function PlanForm({ profile, existing }: { profile: RecipientProfile; existing: CarePlan }) {
  const navigate = useNavigate()
  const back = `/care-recipients/${profile.id}/care-plan`
  const save = useSaveCarePlan(profile.id)
  const creating =
    existing.goals.length === 0 &&
    existing.schedule.length === 0 &&
    existing.medicalNeeds.length === 0 &&
    existing.behavioural.length === 0

  const [goals, setGoals] = useState<CareGoal[]>(() => existing.goals.map((g) => ({ ...g })))
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(() =>
    existing.schedule.map((s) => ({ ...s, time: to24(s.time) })),
  )
  const [medical, setMedical] = useState<Instruction[]>(() => existing.medicalNeeds.map((i) => ({ ...i })))
  const [behavioural, setBehavioural] = useState<Instruction[]>(() => existing.behavioural.map((i) => ({ ...i })))
  const [summary, setSummary] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const patch = <T extends { id: string }>(set: React.Dispatch<React.SetStateAction<T[]>>, id: string, change: Partial<T>) =>
    set((rows) => rows.map((r) => (r.id === id ? { ...r, ...change } : r)))
  const remove = <T extends { id: string }>(set: React.Dispatch<React.SetStateAction<T[]>>, id: string) =>
    set((rows) => rows.filter((r) => r.id !== id))

  const goalError = (g: CareGoal) =>
    !g.title.trim() ? 'Enter the goal.' : !(g.percent >= 0 && g.percent <= 100) ? 'Progress is 0 to 100.' : undefined
  const scheduleError = (s: ScheduleEntry) => (!s.time ? 'Enter a time.' : !s.title.trim() ? 'Enter the activity.' : undefined)
  const instructionError = (i: Instruction) => (i.text.trim() ? undefined : 'Enter the instruction, or remove the row.')
  const invalid =
    goals.some(goalError) || schedule.some(scheduleError) || medical.some(instructionError) || behavioural.some(instructionError)
  const show = (msg: string | undefined) => (submitted ? msg : undefined)

  const saveError = save.isError
    ? save.error instanceof ApiError
      ? save.error.message
      : 'Could not save the care plan. Please try again.'
    : null

  const actions = (
    <div className="flex gap-2">
      <Link to={back} className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium">
        Cancel
      </Link>
      <button
        type="submit"
        disabled={save.isPending}
        className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {save.isPending ? 'Saving…' : creating ? 'Create Care Plan' : 'Save Care Plan'}
      </button>
    </div>
  )

  const instructionList = (rows: Instruction[], set: React.Dispatch<React.SetStateAction<Instruction[]>>, noun: string) =>
    rows.length === 0 ? (
      empty(`No ${noun} yet.`)
    ) : (
      <ul className="space-y-3">
        {rows.map((i, n) => (
          <li key={i.id} className="flex items-start gap-3">
            <Labelled label={`Instruction ${n + 1}`} error={show(instructionError(i))} className="flex-1">
              <input className={fieldControl} value={i.text} onChange={(e) => patch(set, i.id, { text: e.target.value })} />
            </Labelled>
            <Labelled label="Level" className="w-32 shrink-0">
              <SelectBox className={fieldControl} value={i.level} onChange={(e) => patch(set, i.id, { level: e.target.value as InstructionLevel })}>
                {levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </SelectBox>
            </Labelled>
            <div className="pt-6"><RemoveButton label={`Remove instruction ${n + 1}`} onClick={() => remove(set, i.id)} /></div>
          </li>
        ))}
      </ul>
    )

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        if (invalid) return
        save.mutate(
          {
            revisionNote:
              summary.trim() || (creating ? 'Initial care plan created' : 'Care plan updated'),
            goals: goals.map((g) => ({
              label: g.title.trim(),
              progressPercent: g.percent,
              status: g.status,
            })),
            blocks: [...schedule]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((s) => ({
                startMinute: toStartMinute(s.time),
                title: s.title.trim(),
                description: s.detail.trim(),
              })),
            medical: medical.map((i) => ({ text: i.text.trim(), level: i.level })),
            behavioural: behavioural.map((i) => ({ text: i.text.trim(), level: i.level })),
          },
          { onSuccess: () => navigate(back) },
        )
      }}
    >
      <nav aria-label="Breadcrumb">
        <ol className="text-ink-muted flex flex-wrap items-center gap-1.5 text-sm">
          <li><Link to="/care-recipients" className="hover:text-ink">Care Recipients</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li><Link to={back} className="hover:text-ink">{profile.name}</Link></li>
          <li aria-hidden="true"><ChevronRight className="size-3.5" strokeWidth={2.4} /></li>
          <li className="text-ink" aria-current="page">{creating ? 'Create Care Plan' : 'Edit Care Plan'}</li>
        </ol>
      </nav>

      <header className="-mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-ink text-2xl font-bold tracking-tight">{creating ? 'Create Care Plan' : 'Edit Care Plan'}</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Goals, daily schedule and care instructions for {profile.name}.
          </p>
        </div>
        {actions}
      </header>

      {submitted && invalid && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          Some rows are incomplete. Fill them in or remove them before saving.
        </div>
      )}
      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {saveError}
        </div>
      )}

      <SectionCard
        title="Care Goals"
        description="What the plan is working towards, and how far along each goal is."
        addLabel="Add Goal"
        onAdd={() =>
          setGoals((g) => [
            ...g,
            { id: newId('g'), title: '', intent: '', percent: 0, status: 'on-track', target: '', reviewedBy: '' },
          ])
        }
      >
        {goals.length === 0 ? (
          empty('No goals yet.')
        ) : (
          <ul className="divide-line divide-y">
            {goals.map((g, n) => (
              <li key={g.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Labelled label={`Goal ${n + 1}`} error={show(goalError(g))} className="sm:col-span-2 lg:col-span-2">
                      <input className={fieldControl} value={g.title} onChange={(e) => patch(setGoals, g.id, { title: e.target.value })} />
                    </Labelled>
                    <Labelled label="Progress (%)">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className={fieldControl}
                        value={Number.isFinite(g.percent) ? g.percent : ''}
                        onChange={(e) => patch(setGoals, g.id, { percent: e.target.value === '' ? NaN : Number(e.target.value) })}
                      />
                    </Labelled>
                    <Labelled label="Status">
                      <SelectBox className={fieldControl} value={g.status} onChange={(e) => patch(setGoals, g.id, { status: e.target.value as GoalStatus })}>
                        {statuses.map((st) => <option key={st} value={st}>{goalStatusLabels[st]}</option>)}
                      </SelectBox>
                    </Labelled>
                  </div>
                  <div className="pt-6"><RemoveButton label={`Remove goal ${n + 1}`} onClick={() => remove(setGoals, g.id)} /></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Daily Schedule"
        description="The day's routine, in time order. Rows are sorted by time when saved."
        addLabel="Add Activity"
        onAdd={() => setSchedule((s) => [...s, { id: newId('s'), time: '', title: '', detail: '' }])}
      >
        {schedule.length === 0 ? (
          empty('No activities yet.')
        ) : (
          <ul className="space-y-3">
            {schedule.map((s, n) => (
              <li key={s.id} className="flex items-start gap-3">
                <Labelled label="Time" className="w-32 shrink-0">
                  <input type="time" className={fieldControl} value={s.time} onChange={(e) => patch(setSchedule, s.id, { time: e.target.value })} />
                </Labelled>
                <Labelled label={`Activity ${n + 1}`} error={show(scheduleError(s))} className="flex-1">
                  <input className={fieldControl} value={s.title} onChange={(e) => patch(setSchedule, s.id, { title: e.target.value })} />
                </Labelled>
                <Labelled label="Details" className="hidden flex-1 md:block">
                  <input className={fieldControl} value={s.detail} onChange={(e) => patch(setSchedule, s.id, { detail: e.target.value })} />
                </Labelled>
                <div className="pt-6"><RemoveButton label={`Remove activity ${n + 1}`} onClick={() => remove(setSchedule, s.id)} /></div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Medical Needs"
        description="Clinical instructions for every caregiver. Critical and caution items are highlighted on the plan."
        addLabel="Add Instruction"
        onAdd={() => setMedical((m) => [...m, { id: newId('mn'), text: '', level: 'standard' }])}
      >
        {instructionList(medical, setMedical, 'medical needs')}
      </SectionCard>

      <SectionCard
        title="Behavioural Notes"
        description="Preferences, triggers and what works, so care feels consistent."
        addLabel="Add Note"
        onAdd={() => setBehavioural((b) => [...b, { id: newId('bn'), text: '', level: 'standard' }])}
      >
        {instructionList(behavioural, setBehavioural, 'behavioural notes')}
      </SectionCard>

      <section aria-labelledby="plan-revision" className="card p-5 sm:p-6">
        <h2 id="plan-revision" className="text-ink text-base font-semibold tracking-tight">Revision Note</h2>
        <p className="text-ink-muted mt-0.5 text-sm">
          Added to the revision history when you save.
        </p>
        <Labelled label="Summary of changes (optional)" className="mt-4">
          <input
            className={fieldControl}
            maxLength={120}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={creating ? 'Initial care plan created' : 'e.g. Evening medication schedule adjusted'}
          />
        </Labelled>
      </section>

      <div className="flex justify-end">{actions}</div>
    </form>
  )
}
