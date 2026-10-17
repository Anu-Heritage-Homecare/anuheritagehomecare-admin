import { useState } from 'react'
import {
  Archive,
  Bell,
  LayoutTemplate,
  MessageSquare,
  Plus,
} from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Toggle } from '@/components/ui/Toggle'
import {
  QUIET_HOURS,
  archiveOptions,
  deleteQuickReply,
  deleteTemplate,
  messageSettings,
  saveQuickReply,
  saveTemplate,
  setArchiveAfterDays,
  setAutoArchiveReadAnnouncements,
  setEmergencySound,
  setNotification,
  useMessageSettings,
} from '@/features/messages/settings'
import type {
  MessageTemplate,
  NotificationPrefs,
  QuickReply,
} from '@/features/messages/settings'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

/**
 * Message Settings.
 *
 * The lists here are the ones the composer offers, and the auto-archive rules
 * are the ones the folders read — changing either moves the inbox straight
 * away. The notification switches record how this account wants to be reached.
 */
export function MessageSettingsPage() {
  useMessageSettings()
  const settings = messageSettings()
  const [reply, setReply] = useState<QuickReply | 'new' | null>(null)
  const [template, setTemplate] = useState<MessageTemplate | 'new' | null>(null)

  const notifications: {
    key: keyof NotificationPrefs
    label: string
    hint: string
  }[] = [
    {
      key: 'desktop',
      label: 'Desktop notifications',
      hint: 'Show popup alerts on incoming messages',
    },
    {
      key: 'email',
      label: 'Email notifications',
      hint: 'Receive digest email when offline',
    },
    {
      key: 'sms',
      label: 'SMS for urgent messages',
      hint: 'Send text notification for highly critical issues',
    },
    {
      key: 'quietHours',
      label: `Quiet hours (${QUIET_HOURS})`,
      hint: 'Mute non-urgent alerts during scheduled resting hours',
    },
  ]

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-ink text-2xl font-bold tracking-tight">
          Message Settings
        </h1>
        <p className="text-ink-muted mt-1 text-sm">
          Configure messaging preferences
        </p>
      </header>

      <Section icon={Bell} title="Notification Preferences">
        <ul className="divide-line divide-y">
          {notifications.map((row) => (
            <li key={row.key} className="px-4 py-3.5">
              <Toggle
                label={row.label}
                hint={row.hint}
                checked={settings.notifications[row.key]}
                onChange={(next) => setNotification(row.key, next)}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        icon={MessageSquare}
        title="Quick Replies"
        action={<Add label="Add" onClick={() => setReply('new')} />}
      >
        <ul className="space-y-2 p-4">
          {settings.quickReplies.map((item) => (
            <li
              key={item.id}
              className="bg-canvas flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2.5"
            >
              <span className="text-ink min-w-0 text-sm">
                &ldquo;{item.text}&rdquo;
              </span>
              <span className="flex shrink-0 items-center gap-3 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setReply(item)}
                  className="text-ink-muted hover:text-ink"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteQuickReply(item.id)}
                  className="text-red-600"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
          {settings.quickReplies.length === 0 && (
            <li className="text-ink-subtle text-sm">
              No quick replies. The composer offers these under the template
              button.
            </li>
          )}
        </ul>
      </Section>

      <Section
        icon={LayoutTemplate}
        title="Message Templates"
        action={<Add label="Create New" onClick={() => setTemplate('new')} />}
      >
        <ul className="space-y-2 p-4">
          {settings.templates.map((item) => (
            <li
              key={item.id}
              className="border-line flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            >
              <span className="min-w-0">
                <span className="text-ink block text-sm font-medium">
                  {item.name}
                </span>
                <span className="text-ink-subtle line-clamp-1 block text-xs">
                  {item.body}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setTemplate(item)}
                  className="text-ink-muted hover:text-ink"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(item.id)}
                  className="text-ink-muted hover:text-ink"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Archive} title="Auto-Archive Preferences">
        <div className="p-4 pt-1">
          <label
            htmlFor="archive-after"
            className="text-ink block text-sm font-medium"
          >
            Archive inactive conversations after
          </label>
          <SelectBox
            id="archive-after"
            value={settings.archiveAfterDays}
            onChange={(e) => setArchiveAfterDays(Number(e.target.value))}
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          >
            {archiveOptions.map((days) => (
              <option key={days} value={days}>
                {archiveLabel(days)}
              </option>
            ))}
          </SelectBox>
        </div>

        <div className="border-line border-t p-4">
          <Toggle
            label="Auto-archive read announcements"
            hint="Automatically move broadcasts to archive once viewed"
            checked={settings.autoArchiveReadAnnouncements}
            onChange={setAutoArchiveReadAnnouncements}
          />
        </div>
      </Section>

      <section className="card overflow-hidden">
        <h2 className="flex items-center gap-2 px-4 pt-4 pb-2 text-sm font-bold tracking-tight text-red-700">
          <span
            aria-hidden="true"
            className="inline-block size-2 rounded-full bg-red-600"
          />
          Emergency Notifications (Critical Alerts)
        </h2>
        <div className="divide-line sm:divide-line grid gap-4 p-4 pt-1 sm:grid-cols-2 sm:gap-0 sm:divide-x">
          <div className="sm:pr-5">
            <Toggle
              label={
                <span className="flex flex-wrap items-center gap-2">
                  Always notify for emergency messages
                  {/* Not a switch dressed as one: it cannot be turned off, and
                      the chip is what says so. */}
                  <span className="border-line text-ink-subtle inline-flex items-center rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wider uppercase">
                    Locked
                  </span>
                </span>
              }
              labelClassName="font-semibold"
              hint="Emergency signals bypass quiet hours and device silent settings"
              checked
              disabled
              onChange={() => {}}
            />
          </div>
          <div className="sm:pl-5">
            <Toggle
              label="Emergency sound alert"
              labelClassName="font-semibold"
              hint="Play a distinct siren/ping sound for urgent care dispatch"
              checked={settings.emergencySound}
              onChange={setEmergencySound}
            />
          </div>
        </div>
      </section>

      {reply && (
        <QuickReplyDialog
          reply={reply === 'new' ? null : reply}
          onClose={() => setReply(null)}
        />
      )}
      {template && (
        <TemplateDialog
          template={template === 'new' ? null : template}
          onClose={() => setTemplate(null)}
        />
      )}
    </div>
  )
}

/** "30 days", or the option that turns the rule off. */
function archiveLabel(days: number): string {
  return days === 0 ? 'Never' : `${days} days`
}

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Bell
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="text-ink flex items-center gap-2 text-sm font-bold tracking-tight">
          <Icon
            className="text-brand-600 size-4.5"
            strokeWidth={1.9}
            aria-hidden="true"
          />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Add({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-brand-700 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
    >
      <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
      {label}
    </button>
  )
}

function QuickReplyDialog({
  reply,
  onClose,
}: {
  reply: QuickReply | null
  onClose: () => void
}) {
  const [text, setText] = useState(reply?.text ?? '')

  return (
    <Drawer
      open
      onClose={onClose}
      placement="center"
      title={reply ? 'Edit quick reply' : 'Add a quick reply'}
      subtitle="Offered in the composer, under the template button"
    >
      <form
        className="space-y-4 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          saveQuickReply(reply?.id ?? null, text)
          onClose()
        }}
      >
        <label className="block">
          <span className="text-ink text-sm font-medium">Reply</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Thank you for the update"
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <Buttons onClose={onClose} disabled={text.trim() === ''} />
      </form>
    </Drawer>
  )
}

function TemplateDialog({
  template,
  onClose,
}: {
  template: MessageTemplate | null
  onClose: () => void
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [body, setBody] = useState(template?.body ?? '')

  return (
    <Drawer
      open
      onClose={onClose}
      placement="center"
      title={template ? 'Edit template' : 'Create a template'}
      subtitle="Offered in the composer, under the template button"
    >
      <form
        className="space-y-4 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          saveTemplate(template?.id ?? null, name, body)
          onClose()
        }}
      >
        <label className="block">
          <span className="text-ink text-sm font-medium">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Visit Confirmation"
            className="border-line focus:border-brand-500 mt-1.5 h-11 w-full rounded-lg border px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-ink text-sm font-medium">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="border-line focus:border-brand-500 mt-1.5 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <Buttons
          onClose={onClose}
          disabled={name.trim() === '' || body.trim() === ''}
        />
      </form>
    </Drawer>
  )
}

function Buttons({
  onClose,
  disabled,
}: {
  onClose: () => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="border-control text-ink hover:bg-sunken inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className={cn(
          'bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white',
        )}
      >
        Save
      </button>
    </div>
  )
}
