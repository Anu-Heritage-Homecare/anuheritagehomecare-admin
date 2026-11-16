import { useState } from 'react'
import { Loader2, SquarePen } from 'lucide-react'
import {
  channelOptions,
  formatMinutes,
  lateOptions,
  leadOptions,
  recipientOptions,
  smsProviders,
  triggerOptions,
  useNotificationMutations,
  useNotificationSettings,
} from '@/features/settings/notifications'
import type {
  Channel,
  EmergencyAlerts,
  NotificationRule,
  NotificationsView,
  ReminderRules,
} from '@/features/settings/notifications'
import { Drawer } from '@/components/ui/Drawer'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'

type Dialog = 'reminders' | 'emergency' | null

function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const id = `notify-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
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

function CardButton({
  label,
  name,
  icon: Icon,
  onClick,
}: {
  label: string
  name: string
  icon: typeof SquarePen
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      className="border-control text-ink hover:bg-sunken inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  )
}

function Rules({
  channel,
  rules,
  onToggle,
  pendingKey,
}: {
  channel: Channel
  rules: NotificationRule[]
  onToggle: (channel: Channel, key: string, on: boolean) => void
  pendingKey: string | null
}) {
  return (
    <ul className="divide-line divide-y">
      {rules.map((r) => (
        <li key={r.id} className="py-3 first:pt-0 last:pb-0">
          <Toggle
            solidOff
            label={r.label}
            hint={r.hint}
            checked={r.on}
            disabled={pendingKey === `${channel}:${r.id}`}
            onChange={(v) => onToggle(channel, r.id, v)}
            className="items-center"
            labelClassName="font-semibold"
          />
        </li>
      ))}
    </ul>
  )
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-muted text-sm font-medium">{label}</dt>
      <dd className="text-ink text-right text-sm">{children}</dd>
    </div>
  )
}

function Stacked({ label, danger, children }: { label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-subtle text-[0.6875rem] font-medium tracking-wide uppercase">{label}</dt>
      <dd className={cn('mt-1 text-sm', danger ? 'font-medium text-red-600' : 'text-ink')}>{children}</dd>
    </div>
  )
}

export function NotificationsSettingsPage() {
  const { data, isPending, isError, error, refetch } = useNotificationSettings()
  const { setToggle, setReminders, setEmergency, setSmsProvider } = useNotificationMutations()
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)

  const onToggle = (channel: Channel, key: string, on: boolean): void => {
    setToggle.mutate({ channel, key, enabled: on })
  }
  const pendingKey = setToggle.isPending
    ? `${setToggle.variables.channel}:${setToggle.variables.key}`
    : null

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-ink text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Configure global alert pathways for caregivers, families, and system coordinators.
        </p>
      </header>

      {isPending ? (
        <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Loading notifications…
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-ink text-sm font-medium">Could not load notification settings.</p>
          <p className="text-ink-subtle text-sm">{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <Loaded
          data={data}
          dialog={dialog}
          setDialog={setDialog}
          close={close}
          onToggle={onToggle}
          pendingKey={pendingKey}
          saveReminders={(r) => setReminders.mutate(r, { onSuccess: close })}
          savingReminders={setReminders.isPending}
          saveEmergency={(e) => setEmergency.mutate(e, { onSuccess: close })}
          savingEmergency={setEmergency.isPending}
          saveSmsProvider={(name) => setSmsProvider.mutate(name)}
          savingSmsProvider={setSmsProvider.isPending}
        />
      )}
    </div>
  )
}

function Loaded({
  data,
  dialog,
  setDialog,
  close,
  onToggle,
  pendingKey,
  saveReminders,
  savingReminders,
  saveEmergency,
  savingEmergency,
  saveSmsProvider,
  savingSmsProvider,
}: {
  data: NotificationsView
  dialog: Dialog
  setDialog: (d: Dialog) => void
  close: () => void
  onToggle: (channel: Channel, key: string, on: boolean) => void
  pendingKey: string | null
  saveReminders: (r: ReminderRules) => void
  savingReminders: boolean
  saveEmergency: (e: EmergencyAlerts) => void
  savingEmergency: boolean
  saveSmsProvider: (name: string | null) => void
  savingSmsProvider: boolean
}) {
  return (
    <>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <Card title="Email Notifications">
          <Rules channel="email" rules={data.rules.email} onToggle={onToggle} pendingKey={pendingKey} />
        </Card>

        <div className="space-y-5">
          <Card
            title="Visit Reminders"
            action={<CardButton label="Edit Rules" name="Edit visit reminder rules" icon={SquarePen} onClick={() => setDialog('reminders')} />}
          >
            <dl className="divide-line divide-y">
              <Line label="Caregiver Reminder">
                <span className="font-semibold">{formatMinutes(data.reminders.caregiverMinutes)} before</span>
              </Line>
              <Line label="Family Notification">{formatMinutes(data.reminders.familyMinutes)} before start</Line>
              <Line label="Coordinator Alert">
                <span className="font-medium text-red-600">If late by {formatMinutes(data.reminders.lateMinutes)}</span>
              </Line>
            </dl>
          </Card>

          <Card
            title="Emergency Alerts"
            action={<CardButton label="Edit" name="Edit emergency alerts" icon={SquarePen} onClick={() => setDialog('emergency')} />}
          >
            <dl className="divide-line divide-y">
              <Stacked label="Recipients">{data.emergency.recipients.join(', ') || '—'}</Stacked>
              <Stacked label="Channels">{data.emergency.channels.join(' + ') || '—'}</Stacked>
              <Stacked label="Triggers" danger>{data.emergency.triggers.join(', ') || '—'}</Stacked>
            </dl>
          </Card>
        </div>

        <Card title="SMS Notifications">
          <Rules channel="sms" rules={data.rules.sms} onToggle={onToggle} pendingKey={pendingKey} />
          <div className="border-line mt-3 flex items-center justify-between gap-4 border-t pt-3">
            <span className="text-ink-muted text-sm font-medium">SMS Provider Integration</span>
            <span className="flex items-center gap-2">
              <SelectBox
                aria-label="SMS provider"
                value={data.smsProvider.name ?? ''}
                disabled={savingSmsProvider}
                onChange={(e) => saveSmsProvider(e.target.value)}
                className="border-control focus:border-brand-500 bg-surface h-9 rounded-lg border px-3 text-sm font-semibold"
              >
                {data.smsProvider.name === null && <option value="">Not set</option>}
                {smsProviders.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </SelectBox>
              {data.smsProvider.connected && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-700">
                  Connected
                </span>
              )}
            </span>
          </div>
        </Card>

        <Card title="Push Notifications">
          <Rules channel="push" rules={data.rules.push} onToggle={onToggle} pendingKey={pendingKey} />
        </Card>
      </div>

      <Drawer open={dialog === 'reminders'} onClose={close} title="Edit visit reminder rules" placement="center">
        <RemindersForm reminders={data.reminders} onSave={saveReminders} saving={savingReminders} onCancel={close} />
      </Drawer>
      <Drawer open={dialog === 'emergency'} onClose={close} title="Edit emergency alerts" placement="center">
        <EmergencyForm emergency={data.emergency} availableTriggers={data.availableTriggers} onSave={saveEmergency} saving={savingEmergency} onCancel={close} />
      </Drawer>
    </>
  )
}

/* ---------------------------------- forms ---------------------------------- */
/* Each holds a local draft; nothing changes until Save. */

function Actions({
  onCancel,
  disabled = false,
  saving = false,
}: {
  onCancel: () => void
  disabled?: boolean
  saving?: boolean
}) {
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
        disabled={disabled || saving}
        className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
      >
        {saving && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
        Save
      </button>
    </div>
  )
}

function Minutes({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number
  options: number[]
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="text-ink text-sm font-medium">{label}</span>
      <SelectBox value={value} onChange={(e) => onChange(Number(e.target.value))} className={fieldClass}>
        {options.map((m) => (
          <option key={m} value={m}>
            {formatMinutes(m)}
          </option>
        ))}
      </SelectBox>
    </label>
  )
}

function RemindersForm({
  reminders,
  onSave,
  saving,
  onCancel,
}: {
  reminders: ReminderRules
  onSave: (r: ReminderRules) => void
  saving: boolean
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(reminders)

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
      }}
    >
      <Minutes label="Remind the caregiver before the visit" value={draft.caregiverMinutes} options={leadOptions} onChange={(caregiverMinutes) => setDraft({ ...draft, caregiverMinutes })} />
      <Minutes label="Notify the family before the start" value={draft.familyMinutes} options={leadOptions} onChange={(familyMinutes) => setDraft({ ...draft, familyMinutes })} />
      <Minutes label="Alert the coordinator when the caregiver is late by" value={draft.lateMinutes} options={lateOptions} onChange={(lateMinutes) => setDraft({ ...draft, lateMinutes })} />
      <Actions onCancel={onCancel} saving={saving} />
    </form>
  )
}

function Checks({
  legend,
  options,
  chosen,
  onChange,
}: {
  legend: string
  options: readonly string[]
  chosen: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <fieldset>
      <legend className="text-ink text-sm font-medium">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {options.map((o) => (
          <label key={o} className="text-ink flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={chosen.includes(o)}
              // Kept in the options' own order, so the card reads the same
              // whichever box was ticked last.
              onChange={(e) =>
                onChange(options.filter((x) => (x === o ? e.target.checked : chosen.includes(x))))
              }
              className="accent-brand-600 size-4"
            />
            {o}
          </label>
        ))}
      </div>
      {chosen.length === 0 && <p className="mt-1.5 text-xs text-red-700">Choose at least one.</p>}
    </fieldset>
  )
}

function EmergencyForm({
  emergency,
  availableTriggers,
  onSave,
  saving,
  onCancel,
}: {
  emergency: EmergencyAlerts
  availableTriggers: string[]
  onSave: (e: EmergencyAlerts) => void
  saving: boolean
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(emergency)
  // Prefer the backend's trigger catalog; fall back to the static list if empty.
  const triggers = availableTriggers.length > 0 ? availableTriggers : triggerOptions
  const valid = draft.recipients.length > 0 && draft.channels.length > 0 && draft.triggers.length > 0

  return (
    <form
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSave(draft)
      }}
    >
      <Checks legend="Recipients" options={recipientOptions} chosen={draft.recipients} onChange={(recipients) => setDraft({ ...draft, recipients })} />
      <Checks legend="Channels" options={channelOptions} chosen={draft.channels} onChange={(channels) => setDraft({ ...draft, channels })} />
      <Checks legend="Triggers" options={triggers} chosen={draft.triggers} onChange={(next) => setDraft({ ...draft, triggers: next })} />
      <Actions onCancel={onCancel} disabled={!valid} saving={saving} />
    </form>
  )
}
