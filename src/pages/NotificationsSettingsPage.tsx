import { useState } from 'react'
import { Settings, SquarePen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  channelOptions,
  formatMinutes,
  lateOptions,
  leadOptions,
  recipientOptions,
  setConfig,
  setEmergency,
  setReminders,
  setRule,
  smsProviders,
  triggerOptions,
  useNotificationSettings,
  validEmail,
  validSenderId,
} from '@/features/settings/notifications'
import type {
  Channel,
  ChannelConfig,
  EmergencyAlerts,
  NotificationRule,
  ReminderRules,
  SmsProvider,
} from '@/features/settings/notifications'
import { Drawer } from '@/components/ui/Drawer'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'

type Dialog = Channel | 'reminders' | 'emergency' | null

function Card({
  title,
  action,
  children,
}: {
  title: string
  action: React.ReactNode
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
  /** What it acts on, for assistive tech — four of these read "Configure". */
  name: string
  icon: LucideIcon
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

function Rules({ channel, rules }: { channel: Channel; rules: NotificationRule[] }) {
  return (
    <ul className="divide-line divide-y">
      {rules.map((r) => (
        <li key={r.id} className="py-3 first:pt-0 last:pb-0">
          <Toggle
            solidOff
            label={r.label}
            hint={r.hint}
            checked={r.on}
            onChange={(v) => setRule(channel, r.id, v)}
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
  const s = useNotificationSettings()
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)
  const configure = (channel: Channel, name: string) => (
    <CardButton label="Configure" name={`Configure ${name}`} icon={Settings} onClick={() => setDialog(channel)} />
  )

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-ink text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Configure global alert pathways for caregivers, families, and system coordinators.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <Card title="Email Notifications" action={configure('email', 'email notifications')}>
          <Rules channel="email" rules={s.rules.email} />
        </Card>

        <div className="space-y-5">
          <Card
            title="Visit Reminders"
            action={<CardButton label="Edit Rules" name="Edit visit reminder rules" icon={SquarePen} onClick={() => setDialog('reminders')} />}
          >
            <dl className="divide-line divide-y">
              <Line label="Caregiver Reminder">
                <span className="font-semibold">{formatMinutes(s.reminders.caregiverMinutes)} before</span>
              </Line>
              <Line label="Family Notification">{formatMinutes(s.reminders.familyMinutes)} before start</Line>
              <Line label="Coordinator Alert">
                <span className="font-medium text-red-600">If late by {formatMinutes(s.reminders.lateMinutes)}</span>
              </Line>
            </dl>
          </Card>

          <Card
            title="Emergency Alerts"
            action={<CardButton label="Edit" name="Edit emergency alerts" icon={SquarePen} onClick={() => setDialog('emergency')} />}
          >
            <dl className="divide-line divide-y">
              <Stacked label="Recipients">{s.emergency.recipients.join(', ')}</Stacked>
              <Stacked label="Channels">{s.emergency.channels.join(' + ')}</Stacked>
              <Stacked label="Triggers" danger>{s.emergency.triggers.join(', ')}</Stacked>
            </dl>
          </Card>
        </div>

        <Card title="SMS Notifications" action={configure('sms', 'SMS notifications')}>
          <Rules channel="sms" rules={s.rules.sms} />
          <div className="border-line mt-3 flex items-center justify-between gap-4 border-t pt-3">
            <span className="text-ink-muted text-sm font-medium">SMS Provider Integration</span>
            <span className="flex items-center gap-2">
              <span className="text-ink text-sm font-semibold">{s.config.sms.provider}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-700">
                Connected
              </span>
            </span>
          </div>
        </Card>

        <Card title="Push Notifications" action={configure('push', 'push notifications')}>
          <Rules channel="push" rules={s.rules.push} />
        </Card>
      </div>

      <Drawer open={dialog === 'email'} onClose={close} title="Configure email" placement="center">
        <EmailForm config={s.config.email} onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'sms'} onClose={close} title="Configure SMS" placement="center">
        <SmsForm config={s.config.sms} onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'push'} onClose={close} title="Configure push" placement="center">
        <PushForm config={s.config.push} onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'reminders'} onClose={close} title="Edit visit reminder rules" placement="center">
        <RemindersForm reminders={s.reminders} onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'emergency'} onClose={close} title="Edit emergency alerts" placement="center">
        <EmergencyForm emergency={s.emergency} onDone={close} />
      </Drawer>
    </div>
  )
}

/* ---------------------------------- forms ---------------------------------- */
/* Each holds a local draft; nothing changes until Save. */

function Text({
  label,
  value,
  onChange,
  error,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | false
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-ink text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(fieldClass, error && 'border-red-500')}
      />
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  )
}

function Actions({ onCancel, disabled = false }: { onCancel: () => void; disabled?: boolean }) {
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
        Save
      </button>
    </div>
  )
}

function EmailForm({ config, onDone }: { config: ChannelConfig['email']; onDone: () => void }) {
  const [senderName, setSenderName] = useState(config.senderName)
  const [replyTo, setReplyTo] = useState(config.replyTo)
  const emailOk = validEmail(replyTo)
  const valid = senderName.trim() !== '' && emailOk

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        setConfig('email', { senderName: senderName.trim(), replyTo: replyTo.trim() })
        onDone()
      }}
    >
      <Text label="Sender name" value={senderName} onChange={setSenderName} error={senderName.trim() === '' && 'Enter a sender name.'} />
      <Text label="Reply-to address" type="email" value={replyTo} onChange={setReplyTo} error={!emailOk && 'Enter a valid email address.'} />
      <Actions onCancel={onDone} disabled={!valid} />
    </form>
  )
}

function SmsForm({ config, onDone }: { config: ChannelConfig['sms']; onDone: () => void }) {
  const [provider, setProvider] = useState<SmsProvider>(config.provider)
  const [senderId, setSenderId] = useState(config.senderId)
  const valid = validSenderId(senderId)

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        setConfig('sms', { provider, senderId })
        onDone()
      }}
    >
      <label className="block">
        <span className="text-ink text-sm font-medium">SMS provider</span>
        <SelectBox value={provider} onChange={(e) => setProvider(e.target.value as SmsProvider)} className={fieldClass}>
          {smsProviders.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </SelectBox>
      </label>
      <Text label="Sender ID" value={senderId} onChange={setSenderId} error={!valid && 'Use 3–11 letters or digits.'} />
      <Actions onCancel={onDone} disabled={!valid} />
    </form>
  )
}

function PushForm({ config, onDone }: { config: ChannelConfig['push']; onDone: () => void }) {
  const [sound, setSound] = useState(config.sound)
  const [preview, setPreview] = useState(config.preview)

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setConfig('push', { sound, preview })
        onDone()
      }}
    >
      <Toggle label="Play a sound" hint="Notifications arrive with the device's alert sound." checked={sound} onChange={setSound} labelClassName="font-medium" />
      <Toggle label="Show message preview" hint="Include the first line of the message on the lock screen." checked={preview} onChange={setPreview} labelClassName="font-medium" />
      <Actions onCancel={onDone} />
    </form>
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

function RemindersForm({ reminders, onDone }: { reminders: ReminderRules; onDone: () => void }) {
  const [draft, setDraft] = useState(reminders)

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setReminders(draft)
        onDone()
      }}
    >
      <Minutes label="Remind the caregiver before the visit" value={draft.caregiverMinutes} options={leadOptions} onChange={(caregiverMinutes) => setDraft({ ...draft, caregiverMinutes })} />
      <Minutes label="Notify the family before the start" value={draft.familyMinutes} options={leadOptions} onChange={(familyMinutes) => setDraft({ ...draft, familyMinutes })} />
      <Minutes label="Alert the coordinator when the caregiver is late by" value={draft.lateMinutes} options={lateOptions} onChange={(lateMinutes) => setDraft({ ...draft, lateMinutes })} />
      <Actions onCancel={onDone} />
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

function EmergencyForm({ emergency, onDone }: { emergency: EmergencyAlerts; onDone: () => void }) {
  const [draft, setDraft] = useState(emergency)
  const valid = draft.recipients.length > 0 && draft.channels.length > 0 && draft.triggers.length > 0

  return (
    <form
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        setEmergency(draft)
        onDone()
      }}
    >
      <Checks legend="Recipients" options={recipientOptions} chosen={draft.recipients} onChange={(recipients) => setDraft({ ...draft, recipients })} />
      <Checks legend="Channels" options={channelOptions} chosen={draft.channels} onChange={(channels) => setDraft({ ...draft, channels })} />
      <Checks legend="Triggers" options={triggerOptions} chosen={draft.triggers} onChange={(triggers) => setDraft({ ...draft, triggers })} />
      <Actions onCancel={onDone} disabled={!valid} />
    </form>
  )
}
