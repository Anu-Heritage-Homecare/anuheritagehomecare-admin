import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleHelp, ClipboardList, Plus, Settings } from 'lucide-react'
import {
  addChecklist,
  addFormat,
  addService,
  formatDuration,
  formatRate,
  guardrailText,
  matchAlgorithms,
  parseWhole,
  setServiceEnabled,
  updateGuardrails,
  useCareOperations,
} from '@/features/settings/care-operations'
import type { Guardrails, MatchAlgorithm } from '@/features/settings/care-operations'
import { Drawer } from '@/components/ui/Drawer'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const outlineButton =
  'border-control text-ink hover:bg-sunken inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors'
const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'

type NumericKey = 'noticeHours' | 'bufferMinutes' | 'maxVisitsPerDay'
type GuardrailKey = keyof Guardrails

/* Labels as the design words them; the ranges are what each field accepts. */
const guardrailRows: { key: GuardrailKey; label: string }[] = [
  { key: 'noticeHours', label: 'Minimum Notice Period' },
  { key: 'bufferMinutes', label: 'Travel Buffer Between Visits' },
  { key: 'maxVisitsPerDay', label: 'Maximum Visits Per Caregiver/Day' },
  { key: 'algorithm', label: 'Auto-Assign Match Algorithms' },
]
const numeric: Record<NumericKey, { field: string; unit: string; min: number; max: number }> = {
  noticeHours: { field: 'Minimum notice period', unit: 'hours', min: 0, max: 168 },
  bufferMinutes: { field: 'Travel buffer between visits', unit: 'minutes', min: 0, max: 240 },
  maxVisitsPerDay: { field: 'Maximum visits per caregiver per day', unit: 'shifts', min: 1, max: 24 },
}
const numericKeys = Object.keys(numeric) as NumericKey[]

type Dialog = 'service' | 'format' | 'template' | 'configure' | GuardrailKey | null

function Card({
  title,
  action,
  children,
}: {
  title: string
  action: React.ReactNode
  children: React.ReactNode
}) {
  const id = `care-ops-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="text-ink min-w-0 text-base font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={outlineButton}>
      <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
      {label}
    </button>
  )
}

export function CareOperationsSettingsPage() {
  const ops = useCareOperations()
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)
  const editingKey = guardrailRows.find((r) => r.key === dialog)?.key

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight">Care Operations</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Configure support services, visit templates, scheduling constraints and rule sets
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog('configure')}
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
        >
          <Settings className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Configure Operations
        </button>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <Card title="Service Offerings & Status" action={<AddButton label="Add Service" onClick={() => setDialog('service')} />}>
          <ul className="divide-line border-line divide-y border-b">
            {ops.services.map((s) => (
              <li key={s.id} className="py-2.5 first:pt-0">
                <Toggle
                  solidOff
                  label={s.name}
                  hint={s.description}
                  checked={s.enabled}
                  onChange={(v) => setServiceEnabled(s.id, v)}
                  className="items-center"
                  labelClassName={cn('font-semibold', !s.enabled && 'text-ink-subtle font-medium')}
                />
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card title="Visit Formats & Billing Rates" action={<AddButton label="Add Format" onClick={() => setDialog('format')} />}>
            <div className="border-line overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[22rem] text-left text-sm">
                <thead className="border-line border-b">
                  <tr className="text-ink text-xs">
                    <th scope="col" className="px-3 py-2 font-medium">Name</th>
                    <th scope="col" className="px-3 py-2 font-medium">Duration</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Base Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {ops.formats.map((f) => (
                    <tr key={f.id}>
                      <th scope="row" className="text-ink px-3 py-2.5 font-semibold">{f.name}</th>
                      <td className="text-ink-muted px-3 py-2.5 whitespace-nowrap">{formatDuration(f.durationHours)}</td>
                      <td className="text-brand-700 px-3 py-2.5 text-right font-semibold whitespace-nowrap">{formatRate(f)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Scheduling Guardrails"
            action={
              <span
                tabIndex={0}
                role="note"
                aria-label="Guardrails are the limits the scheduler holds new visits to."
                title="Guardrails are the limits the scheduler holds new visits to."
                className="text-ink-subtle grid size-6 place-items-center rounded-full"
              >
                <CircleHelp className="size-4" strokeWidth={1.8} aria-hidden="true" />
              </span>
            }
          >
            <dl className="divide-line border-line -mt-1 divide-y border-b">
              {guardrailRows.map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <dt className="text-ink-subtle text-[0.6875rem] font-medium tracking-wide uppercase">{r.label}</dt>
                    <dd className="text-ink mt-0.5 text-sm font-semibold">{guardrailText[r.key](ops.guardrails)}</dd>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDialog(r.key)}
                    aria-label={`Edit ${r.label.toLowerCase()}`}
                    className="text-brand-700 hover:text-brand-800 shrink-0 text-sm font-semibold hover:underline"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Standard Task Checklists" action={<AddButton label="Add Template" onClick={() => setDialog('template')} />}>
            <ul className="space-y-2.5">
              {ops.checklists.map((c) => (
                <li key={c.id}>
                  {/* The Templates screen is where a checklist's items live. */}
                  <Link
                    to="/tasks/templates"
                    className="border-line hover:bg-canvas flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
                  >
                    <ClipboardList className="text-brand-600 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="text-ink block truncate text-sm font-semibold">{c.name}</span>
                      <span className="text-ink-muted block truncate text-xs">{c.summary}</span>
                    </span>
                    <ChevronRight className="text-ink-subtle size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Drawer open={dialog === 'service'} onClose={close} title="Add service" placement="center">
        <ServiceForm onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'format'} onClose={close} title="Add visit format" placement="center">
        <FormatForm onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'template'} onClose={close} title="Add checklist template" placement="center">
        <ChecklistForm onDone={close} />
      </Drawer>
      <Drawer
        open={dialog === 'configure' || Boolean(editingKey)}
        onClose={close}
        title={editingKey ? 'Edit guardrail' : 'Configure operations'}
        subtitle={editingKey ? undefined : 'Scheduling guardrails'}
        placement="center"
      >
        <GuardrailsForm
          key={dialog ?? 'closed'}
          guardrails={ops.guardrails}
          only={editingKey}
          onDone={close}
        />
      </Drawer>
    </div>
  )
}

/* ---------------------------------- forms ---------------------------------- */
/* Each holds a local draft; nothing changes until it is submitted. */

function Text({
  label,
  value,
  onChange,
  error,
  suffix,
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | false
  suffix?: string
  inputMode?: 'numeric'
}) {
  return (
    <label className="block">
      <span className="text-ink text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input
          value={value}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(fieldClass, error && 'border-red-500')}
        />
        {suffix && <span className="text-ink-muted mt-1.5 shrink-0 text-sm">{suffix}</span>}
      </span>
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  )
}

function Actions({ onCancel, disabled, label }: { onCancel: () => void; disabled: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
      >
        {label}
      </button>
    </div>
  )
}

function ServiceForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState(true)
  const valid = Boolean(name.trim() && description.trim())

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        addService({ name: name.trim(), description: description.trim(), enabled })
        onDone()
      }}
    >
      <Text label="Service name" value={name} onChange={setName} />
      <Text label="Description" value={description} onChange={setDescription} />
      <Toggle
        label="Offered"
        hint={enabled ? 'Listed as an active service.' : 'Listed, switched off.'}
        checked={enabled}
        onChange={setEnabled}
        labelClassName="font-medium"
      />
      <Actions onCancel={onDone} disabled={!valid} label="Add Service" />
    </form>
  )
}

function FormatForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [varies, setVaries] = useState(false)
  const [hours, setHours] = useState('')
  const [rate, setRate] = useState('')
  const [hourly, setHourly] = useState(false)
  const hoursValue = parseWhole(hours, 1, 24)
  const rateValue = parseWhole(rate.replace(/,/g, ''), 1, 10_000_000)
  const valid = Boolean(name.trim()) && (varies || hoursValue !== null) && rateValue !== null

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || rateValue === null) return
        addFormat({ name: name.trim(), durationHours: varies ? null : hoursValue, rate: rateValue, hourly })
        onDone()
      }}
    >
      <Text label="Format name" value={name} onChange={setName} />
      <Toggle
        label="Duration varies"
        hint="For a format with no fixed length."
        checked={varies}
        onChange={setVaries}
        labelClassName="font-medium"
      />
      {!varies && (
        <Text
          label="Duration"
          value={hours}
          onChange={setHours}
          inputMode="numeric"
          suffix="hours"
          error={hours !== '' && hoursValue === null && 'Enter whole hours from 1 to 24.'}
        />
      )}
      <Text
        label="Base rate (₦)"
        value={rate}
        onChange={setRate}
        inputMode="numeric"
        error={rate !== '' && rateValue === null && 'Enter an amount in naira.'}
      />
      <Toggle
        label="Charged per hour"
        hint={hourly ? 'Shown as a rate per hour.' : 'Shown as a flat rate per visit.'}
        checked={hourly}
        onChange={setHourly}
        labelClassName="font-medium"
      />
      <Actions onCancel={onDone} disabled={!valid} label="Add Format" />
    </form>
  )
}

function ChecklistForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [count, setCount] = useState('')
  const countValue = parseWhole(count, 1, 99)
  const valid = Boolean(name.trim()) && countValue !== null

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || countValue === null) return
        addChecklist(name.trim(), countValue)
        onDone()
      }}
    >
      <Text label="Checklist name" value={name} onChange={setName} />
      <Text
        label="Number of tasks"
        value={count}
        onChange={setCount}
        inputMode="numeric"
        error={count !== '' && countValue === null && 'Enter a number from 1 to 99.'}
      />
      <Actions onCancel={onDone} disabled={!valid} label="Add Template" />
    </form>
  )
}

/** All four guardrails, or just `only` when one row's Edit opened it. */
function GuardrailsForm({
  guardrails,
  only,
  onDone,
}: {
  guardrails: Guardrails
  only?: GuardrailKey
  onDone: () => void
}) {
  const [text, setText] = useState<Record<NumericKey, string>>({
    noticeHours: String(guardrails.noticeHours),
    bufferMinutes: String(guardrails.bufferMinutes),
    maxVisitsPerDay: String(guardrails.maxVisitsPerDay),
  })
  const [algorithm, setAlgorithm] = useState<MatchAlgorithm>(guardrails.algorithm)
  const shown = (key: GuardrailKey) => !only || only === key
  const parsed = (key: NumericKey) => parseWhole(text[key], numeric[key].min, numeric[key].max)
  const valid = numericKeys.every((k) => !shown(k) || parsed(k) !== null)

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        const patch: Partial<Guardrails> = {}
        for (const k of numericKeys) {
          const v = parsed(k)
          if (shown(k) && v !== null) patch[k] = v
        }
        if (shown('algorithm')) patch.algorithm = algorithm
        updateGuardrails(patch)
        onDone()
      }}
    >
      {numericKeys.filter(shown).map((k) => (
        <Text
          key={k}
          label={numeric[k].field}
          value={text[k]}
          onChange={(v) => setText((t) => ({ ...t, [k]: v }))}
          inputMode="numeric"
          suffix={numeric[k].unit}
          error={parsed(k) === null && `Enter a whole number from ${numeric[k].min} to ${numeric[k].max}.`}
        />
      ))}
      {shown('algorithm') && (
        <label className="block">
          <span className="text-ink text-sm font-medium">Auto-assign match algorithm</span>
          <SelectBox
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as MatchAlgorithm)}
            className={fieldClass}
          >
            {matchAlgorithms.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </SelectBox>
        </label>
      )}
      <Actions onCancel={onDone} disabled={!valid} label="Save" />
    </form>
  )
}
