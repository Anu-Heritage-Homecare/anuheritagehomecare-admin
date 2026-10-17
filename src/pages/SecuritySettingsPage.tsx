import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, Construction, Copy, KeyRound, Settings, SquarePen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  mfaMethodOptions,
  mfaRoleOptions,
  mfaStatuses,
  parseWhole,
  setMfa,
  setPasswordPolicy,
  setSession,
  useSecuritySettings,
} from '@/features/settings/security'
import type { MfaSettings, MfaStatus, PasswordPolicy, SessionSettings } from '@/features/settings/security'
import {
  connect,
  disconnect,
  formatInterval,
  fullKey,
  maskedKey,
  regenerateKey,
  revokeKey,
  saveConfig,
  syncDirections,
  syncEventOptions,
  syncIntervals,
  targetCalendars,
  testConnection,
  useApiKeys,
  useIntegrations,
} from '@/features/settings/integrations'
import type { ApiKey, Integration } from '@/features/settings/integrations'
import { Drawer } from '@/components/ui/Drawer'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/cn'
import { SelectBox } from '@/components/ui/SelectBox'

const tabs = [
  { id: 'security', label: 'Security' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'audit', label: 'Audit Logs' },
] as const
type TabId = (typeof tabs)[number]['id']

const fieldClass =
  'border-control focus:border-brand-500 bg-surface mt-1.5 h-10 w-full rounded-lg border px-3 text-sm'
const th = 'px-3 py-2.5 text-xs font-medium whitespace-nowrap'
const td = 'px-3 py-3 whitespace-nowrap'

type Dialog = 'password' | 'mfa' | 'session' | null

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

function Card({
  title,
  action,
  children,
}: {
  title: string
  action: React.ReactNode
  children: React.ReactNode
}) {
  const id = `security-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
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

function CardButton({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-control text-ink hover:bg-sunken inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  )
}

function Line({ label, strong, children }: { label: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-muted text-sm font-medium">{label}</dt>
      <dd className={cn('text-ink text-right text-sm', strong && 'font-semibold')}>{children}</dd>
    </div>
  )
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={cn('font-medium', value ? 'text-emerald-600' : 'text-ink-muted')}>{value ? 'Yes' : 'No'}</span>
  )
}

const stackedLabel = 'text-ink-subtle text-[0.6875rem] font-medium tracking-wide uppercase'

export function SecuritySettingsPage() {
  const s = useSecuritySettings()
  const [params, setParams] = useSearchParams()
  const tab: TabId = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'security'
  const goTo = (id: TabId) => setParams(id === 'security' ? {} : { tab: id }, { replace: true })
  const integrations = useIntegrations()
  const [configuringId, setConfiguringId] = useState<string | null>(null)
  const configuring = integrations.find((i) => i.id === configuringId)
  const apiKeys = useApiKeys()
  const [viewingKeyId, setViewingKeyId] = useState<string | null>(null)
  const viewingKey = apiKeys.find((k) => k.id === viewingKeyId)
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)
  const mfaOn = s.mfa.status !== 'Disabled'

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-ink text-2xl font-bold tracking-tight">Security &amp; Integrations</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Enforce access protocols, MFA mandates, and monitor audit traces.
        </p>
      </header>

      <nav aria-label="Security and integrations sections" className="border-line no-scrollbar flex gap-2 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => goTo(t.id)}
            className={cn(
              '-mb-px border-b-2 px-3 pb-2.5 text-sm whitespace-nowrap transition-colors',
              t.id === tab
                ? 'border-brand-600 text-brand-700 font-semibold'
                : 'text-ink-muted hover:text-ink border-transparent',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'security' ? (
        <>
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
            <Card title="Password Policy" action={<CardButton label="Edit Policy" icon={SquarePen} onClick={() => setDialog('password')} />}>
              <dl className="divide-line divide-y">
                <Line label="Minimum Length" strong>{plural(s.password.minLength, 'character')}</Line>
                <Line label="Require Uppercase Letter"><YesNo value={s.password.uppercase} /></Line>
                <Line label="Require Numbers"><YesNo value={s.password.numbers} /></Line>
                <Line label="Require Special Character"><YesNo value={s.password.special} /></Line>
                <Line label="Password Expiry Window">
                  {s.password.expiryDays === 0 ? 'Never expires' : plural(s.password.expiryDays, 'day')}
                </Line>
                <Line label="Previous Passwords Blocked">
                  {s.password.blockedPrevious === 0 ? 'None' : `Last ${plural(s.password.blockedPrevious, 'password')}`}
                </Line>
              </dl>
            </Card>

            <div className="space-y-5">
              <Card title="Multi-factor Authentication" action={<CardButton label="Edit MFA" icon={SquarePen} onClick={() => setDialog('mfa')} />}>
                <dl className="divide-line divide-y">
                  <div className="flex items-center justify-between gap-4 pb-3">
                    <dt className="text-ink-muted text-sm font-medium">Global Status</dt>
                    <dd>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          mfaOn ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {s.mfa.status}
                      </span>
                    </dd>
                  </div>
                  <div className="py-3">
                    <dt className={stackedLabel}>MFA Methods Allowed</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                      {s.mfa.methods.length === 0 && <span className="text-ink-muted text-sm">None</span>}
                      {s.mfa.methods.map((m, i) => (
                        <span
                          key={m}
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-medium',
                            i === 0 ? 'bg-brand-50 text-brand-700' : 'border-control text-ink border',
                          )}
                        >
                          {m} ({i === 0 ? 'Primary' : 'Backup'})
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div className="pt-3">
                    <dt className={stackedLabel}>Enforce for Roles</dt>
                    <dd className="text-ink mt-1 text-sm">{s.mfa.roles.join(', ') || 'None'}</dd>
                  </div>
                </dl>
              </Card>

              <Card title="Session settings" action={<CardButton label="Session Config" icon={Settings} onClick={() => setDialog('session')} />}>
                <dl className="divide-line divide-y">
                  <Line label="Session Timeout" strong>{plural(s.session.timeoutMinutes, 'minute')} idle</Line>
                  <Line label="Max Concurrent Sessions">{plural(s.session.maxConcurrent, 'session')} per user</Line>
                  <Line label="Remember Device Window">{plural(s.session.rememberDays, 'day')}</Line>
                </dl>
              </Card>
            </div>
          </div>

          <Card
            title="Recent Login History"
            action={
              <button
                type="button"
                onClick={() => goTo('audit')}
                className="text-brand-700 hover:text-brand-800 text-sm font-semibold underline underline-offset-2"
              >
                View All Logs
              </button>
            }
          >
            <div className="border-line overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="border-line border-b">
                  <tr className="text-ink">
                    <th scope="col" className={th}>Date &amp; Time</th>
                    <th scope="col" className={th}>Operator</th>
                    <th scope="col" className={th}>IP Address</th>
                    <th scope="col" className={th}>Device/Client</th>
                    <th scope="col" className={cn(th, 'text-right')}>Access Status</th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {s.logins.map((l) => (
                    <tr key={`${l.at}-${l.ip}`}>
                      <td className={cn(td, 'text-ink-muted')}>{l.at}</td>
                      <th scope="row" className={cn(td, 'text-ink font-semibold')}>{l.operator}</th>
                      <td className={cn(td, 'text-ink-muted')}>{l.ip}</td>
                      <td className={cn(td, 'text-ink-subtle')}>{l.device}</td>
                      <td className={cn(td, 'text-right')}>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
                            l.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
                          )}
                        >
                          {l.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : tab === 'integrations' ? (
        <div className="space-y-6">
        <ul className="space-y-3">
          {integrations.map((i) => (
            <li key={i.id} className="card flex flex-wrap items-center gap-4 p-4">
              <IntegrationTile />
              <div className="min-w-0 flex-1">
                <p className="text-ink text-sm font-semibold">{i.name}</p>
                <p className="text-ink-muted mt-0.5 text-xs">{i.description}</p>
              </div>
              <span
                className={cn(
                  'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  i.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
                )}
              >
                {i.connected ? 'Connected' : 'Not connected'}
              </span>
              <button
                type="button"
                onClick={() => setConfiguringId(i.id)}
                aria-label={`Configure ${i.name}`}
                className="border-control text-ink hover:bg-sunken inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
              >
                <Settings className="size-3.5" strokeWidth={2} aria-hidden="true" />
                Configure
              </button>
            </li>
          ))}
        </ul>

        <section aria-labelledby="api-keys-heading">
          <h2 id="api-keys-heading" className="text-ink mb-3 text-base font-semibold tracking-tight">API Keys</h2>
          <ul className="space-y-3">
            {apiKeys.map((k) => (
              <li key={k.id} className="card flex flex-wrap items-center gap-4 p-4">
                <span className="bg-brand-50 text-brand-600 grid size-10 shrink-0 place-items-center rounded-lg">
                  <KeyRound className="size-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ink text-sm font-semibold">{k.name}</p>
                  <p className="text-ink-muted mt-0.5 truncate font-mono text-xs">{maskedKey(k)}</p>
                </div>
                <KeyStatus status={k.status} />
                <button
                  type="button"
                  onClick={() => setViewingKeyId(k.id)}
                  aria-label={`View details for ${k.name}`}
                  className="border-control text-ink hover:bg-sunken inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-sm font-medium transition-colors"
                >
                  View Details
                </button>
              </li>
            ))}
          </ul>
        </section>
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
            <Construction className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <p className="text-ink mt-3 text-sm font-semibold">Not built yet</p>
          <p className="text-ink-muted mt-1 max-w-sm text-sm">This tab is waiting on its design.</p>
        </div>
      )}

      <Drawer open={Boolean(configuring)} onClose={() => setConfiguringId(null)} title="Configure Integration">
        {configuring && (
          <IntegrationForm key={configuring.id} integration={configuring} onDone={() => setConfiguringId(null)} />
        )}
      </Drawer>
      <Drawer open={Boolean(viewingKey)} onClose={() => setViewingKeyId(null)} title="API Key Details">
        {viewingKey && <ApiKeyDetails apiKey={viewingKey} onClose={() => setViewingKeyId(null)} />}
      </Drawer>
      <Drawer open={dialog === 'password'} onClose={close} title="Edit password policy" placement="center">
        <PasswordForm policy={s.password} onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'mfa'} onClose={close} title="Edit multi-factor authentication" placement="center">
        <MfaForm mfa={s.mfa} onDone={close} />
      </Drawer>
      <Drawer open={dialog === 'session'} onClose={close} title="Session config" placement="center">
        <SessionForm session={s.session} onDone={close} />
      </Drawer>
    </div>
  )
}

function KeyStatus({ status }: { status: ApiKey['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
      )}
    >
      {status}
    </span>
  )
}

function ApiKeyDetails({ apiKey, onClose }: { apiKey: ApiKey; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  /* Both are one-way, so each asks once before it happens. */
  const [confirming, setConfirming] = useState<'regenerate' | 'revoke' | null>(null)
  const active = apiKey.status === 'Active'
  const heading = 'text-ink text-sm font-semibold'
  const meta: [string, string][] = [
    ['Created:', apiKey.created],
    ['Created by:', apiKey.createdBy],
    ['Last Used:', apiKey.lastUsed],
  ]
  const action =
    'bg-surface inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors disabled:opacity-50'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullKey(apiKey))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the button then simply does not confirm.
      setCopied(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 p-5">
        <div className="border-line bg-canvas rounded-xl border p-3.5">
          <div className="border-line flex items-center justify-between gap-3 border-b pb-3">
            <p className="text-ink text-sm font-semibold">{apiKey.name}</p>
            <KeyStatus status={apiKey.status} />
          </div>
          <dl className="space-y-1.5 pt-3 text-xs">
            {meta.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h3 className={heading}>API Key Value</h3>
          <div className="border-line bg-sunken mt-2 flex items-center gap-2 rounded-lg border py-1.5 pr-1.5 pl-3">
            <code className="text-ink-muted min-w-0 flex-1 truncate font-mono text-xs">{maskedKey(apiKey)}</code>
            <button
              type="button"
              onClick={copy}
              disabled={!active}
              aria-label={copied ? 'Copied' : 'Copy API key'}
              className="border-line bg-surface text-ink hover:bg-canvas grid size-7 shrink-0 place-items-center rounded-md border disabled:opacity-50"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          </div>
          {copied && <p role="status" className="mt-1 text-xs font-medium text-emerald-700">Copied to clipboard.</p>}
        </div>

        <div>
          <h3 className={heading}>Permissions &amp; Scopes</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {apiKey.scopes.map((sc) => (
              <li key={sc} className="bg-brand-50 text-brand-700 rounded-md px-2 py-0.5 text-xs font-medium">{sc}</li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-4">
          <h3 className={heading}>Rate Limit</h3>
          <p className="text-ink-muted text-sm">{apiKey.rateLimitPerHour.toLocaleString('en-US')} requests / hour</p>
        </div>

        <div className="border-line bg-canvas rounded-xl border p-3.5">
          <h3 className="text-ink text-xs font-bold tracking-wide uppercase">Usage Statistics</h3>
          <dl className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-ink-muted text-xs">Today</dt>
              <dd className="text-ink text-lg font-bold tabular-nums">{apiKey.usage.today.toLocaleString('en-US')} reqs</dd>
            </div>
            <div>
              <dt className="text-ink-muted text-xs">This Week</dt>
              <dd className="text-ink text-lg font-bold tabular-nums">{apiKey.usage.week.toLocaleString('en-US')} reqs</dd>
            </div>
          </dl>
        </div>

        {confirming ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800">
              {confirming === 'regenerate'
                ? 'Regenerate this key? The current key stops working straight away.'
                : 'Revoke this key? Anything using it loses access, and this cannot be undone.'}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="border-control bg-surface text-ink hover:bg-sunken inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium"
              >
                Keep Key
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirming === 'regenerate') regenerateKey(apiKey.id)
                  else revokeKey(apiKey.id)
                  setConfirming(null)
                }}
                className="inline-flex h-8 items-center rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700"
              >
                {confirming === 'regenerate' ? 'Regenerate' : 'Revoke'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!active}
              onClick={() => setConfirming('regenerate')}
              className={cn(action, 'border-orange-200 text-orange-600 hover:bg-orange-50')}
            >
              Regenerate Key
            </button>
            <button
              type="button"
              disabled={!active}
              onClick={() => setConfirming('revoke')}
              className={cn(action, 'border-red-200 text-red-600 hover:bg-red-50')}
            >
              Revoke Key
            </button>
          </div>
        )}
      </div>
      {/* Two Close buttons, as the design draws the footer. */}
      <div className="border-line bg-surface sticky bottom-0 flex items-center justify-between gap-2 border-t p-5">
        <button
          type="button"
          onClick={onClose}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          Close
        </button>
      </div>
    </div>
  )
}

/** A generic calendar mark on the design's red tile — not the product's logo. */
function IntegrationTile() {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-red-500 text-white">
      <CalendarDays className="size-5" strokeWidth={2} aria-hidden="true" />
    </span>
  )
}

function IntegrationForm({ integration, onDone }: { integration: Integration; onDone: () => void }) {
  const [draft, setDraft] = useState(integration.config)
  const [tested, setTested] = useState(false)
  const on = integration.connected
  const valid = draft.events.length > 0
  const label = 'text-ink text-sm font-semibold'
  const secondary =
    'bg-surface inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors'

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        saveConfig(integration.id, draft)
        onDone()
      }}
    >
      <div className="flex-1 space-y-4 p-5">
        <div className="border-line bg-canvas flex items-center gap-3 rounded-xl border p-3.5">
          <IntegrationTile />
          <div className="min-w-0">
            <p className="text-ink text-sm font-semibold">{integration.name}</p>
            <p className={cn('mt-0.5 flex items-center gap-1.5 text-xs font-medium', on ? 'text-emerald-600' : 'text-ink-muted')}>
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', on ? 'bg-emerald-500' : 'bg-slate-400')} />
              {on ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>

        {/* A disconnected integration keeps its settings but cannot change them. */}
        <fieldset disabled={!on} className="space-y-4 disabled:opacity-60">
          <label className="block">
            <span className={label}>Sync Direction</span>
            <SelectBox value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value })} className={fieldClass}>
              {syncDirections.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </SelectBox>
          </label>
          <label className="block">
            <span className={label}>Target Calendar</span>
            <SelectBox value={draft.calendar} onChange={(e) => setDraft({ ...draft, calendar: e.target.value })} className={fieldClass}>
              {targetCalendars.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectBox>
          </label>
          <fieldset>
            <legend className={label}>Sync Events</legend>
            <div className="mt-2 space-y-2">
              {syncEventOptions.map((o) => (
                <label key={o} className="text-ink flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.events.includes(o)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        events: syncEventOptions.filter((x) => (x === o ? e.target.checked : draft.events.includes(x))),
                      })
                    }
                    className="accent-brand-600 size-4"
                  />
                  {o}
                </label>
              ))}
            </div>
            {!valid && <p className="mt-1.5 text-xs text-red-700">Choose at least one.</p>}
          </fieldset>
          <label className="block">
            <span className={label}>Auto-sync Interval</span>
            <SelectBox
              value={draft.intervalMinutes}
              onChange={(e) => setDraft({ ...draft, intervalMinutes: Number(e.target.value) })}
              className={fieldClass}
            >
              {syncIntervals.map((m) => (
                <option key={m} value={m}>
                  {formatInterval(m)}
                </option>
              ))}
            </SelectBox>
          </label>
        </fieldset>

        <dl className="border-line bg-canvas space-y-2 rounded-xl border p-3.5 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Connected since:</dt>
            <dd className="text-ink font-semibold">{integration.connectedSince ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Last successful sync:</dt>
            <dd className="text-ink font-semibold">{integration.lastSync ?? '—'}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!on}
            onClick={() => {
              testConnection(integration.id)
              setTested(true)
            }}
            className={cn(secondary, 'border-control text-ink hover:bg-sunken disabled:opacity-50')}
          >
            Test Connection
          </button>
          {on ? (
            <button
              type="button"
              onClick={() => {
                disconnect(integration.id)
                setTested(false)
              }}
              className={cn(secondary, 'border-red-200 text-red-600 hover:bg-red-50')}
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => connect(integration.id)}
              className={cn(secondary, 'border-brand-200 text-brand-700 hover:bg-brand-50')}
            >
              Connect
            </button>
          )}
        </div>
        <p role="status" className="text-xs font-medium text-emerald-700">
          {tested && on ? 'Connection test passed.' : ''}
        </p>
      </div>
      <div className="border-line bg-surface sticky bottom-0 flex items-center justify-between gap-2 border-t p-5">
        <button
          type="button"
          onClick={onDone}
          className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!on || !valid}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
          Save Configuration
        </button>
      </div>
    </form>
  )
}

/* ---------------------------------- forms ---------------------------------- */
/* Each holds a local draft; nothing changes until Save. */

function NumberField({
  label,
  value,
  onChange,
  suffix,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix: string
  error?: string | false
}) {
  return (
    <label className="block">
      <span className="text-ink text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input
          value={value}
          inputMode="numeric"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(fieldClass, error && 'border-red-500')}
        />
        <span className="text-ink-muted mt-1.5 shrink-0 text-sm">{suffix}</span>
      </span>
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

function PasswordForm({ policy, onDone }: { policy: PasswordPolicy; onDone: () => void }) {
  const [minLength, setMinLength] = useState(String(policy.minLength))
  const [expiry, setExpiry] = useState(String(policy.expiryDays))
  const [blocked, setBlocked] = useState(String(policy.blockedPrevious))
  const [flags, setFlags] = useState({ uppercase: policy.uppercase, numbers: policy.numbers, special: policy.special })
  const min = parseWhole(minLength, 6, 64)
  const exp = parseWhole(expiry, 0, 365)
  const blk = parseWhole(blocked, 0, 24)
  const valid = min !== null && exp !== null && blk !== null

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (min === null || exp === null || blk === null) return
        setPasswordPolicy({ ...flags, minLength: min, expiryDays: exp, blockedPrevious: blk })
        onDone()
      }}
    >
      <NumberField label="Minimum length" value={minLength} onChange={setMinLength} suffix="characters" error={min === null && 'Enter a length from 6 to 64.'} />
      <Toggle label="Require uppercase letter" checked={flags.uppercase} onChange={(uppercase) => setFlags({ ...flags, uppercase })} labelClassName="font-medium" />
      <Toggle label="Require numbers" checked={flags.numbers} onChange={(numbers) => setFlags({ ...flags, numbers })} labelClassName="font-medium" />
      <Toggle label="Require special character" checked={flags.special} onChange={(special) => setFlags({ ...flags, special })} labelClassName="font-medium" />
      <NumberField label="Password expiry window" value={expiry} onChange={setExpiry} suffix="days" error={exp === null && 'Enter 0 to 365 days; 0 means never.'} />
      <NumberField label="Previous passwords blocked" value={blocked} onChange={setBlocked} suffix="passwords" error={blk === null && 'Enter a number from 0 to 24.'} />
      <Actions onCancel={onDone} disabled={!valid} />
    </form>
  )
}

function Checks({
  legend,
  options,
  chosen,
  onChange,
  required,
}: {
  legend: string
  options: readonly string[]
  chosen: string[]
  onChange: (next: string[]) => void
  required: boolean
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
              // Kept in the options' own order, which is also priority order.
              onChange={(e) => onChange(options.filter((x) => (x === o ? e.target.checked : chosen.includes(x))))}
              className="accent-brand-600 size-4"
            />
            {o}
          </label>
        ))}
      </div>
      {required && chosen.length === 0 && <p className="mt-1.5 text-xs text-red-700">Choose at least one.</p>}
    </fieldset>
  )
}

function MfaForm({ mfa, onDone }: { mfa: MfaSettings; onDone: () => void }) {
  const [draft, setDraft] = useState(mfa)
  const on = draft.status !== 'Disabled'
  const valid = !on || (draft.methods.length > 0 && draft.roles.length > 0)

  return (
    <form
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        setMfa(draft)
        onDone()
      }}
    >
      <label className="block">
        <span className="text-ink text-sm font-medium">Global status</span>
        <SelectBox
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value as MfaStatus })}
          className={fieldClass}
        >
          {mfaStatuses.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </SelectBox>
      </label>
      <div>
        <Checks legend="Methods allowed" options={mfaMethodOptions} chosen={draft.methods} onChange={(methods) => setDraft({ ...draft, methods })} required={on} />
        <p className="text-ink-subtle mt-1.5 text-xs">The first method ticked is the primary; the rest are backups.</p>
      </div>
      <Checks legend="Enforce for roles" options={mfaRoleOptions} chosen={draft.roles} onChange={(roles) => setDraft({ ...draft, roles })} required={on} />
      <Actions onCancel={onDone} disabled={!valid} />
    </form>
  )
}

function SessionForm({ session, onDone }: { session: SessionSettings; onDone: () => void }) {
  const [timeout, setTimeoutText] = useState(String(session.timeoutMinutes))
  const [max, setMax] = useState(String(session.maxConcurrent))
  const [remember, setRemember] = useState(String(session.rememberDays))
  const t = parseWhole(timeout, 5, 480)
  const m = parseWhole(max, 1, 10)
  const r = parseWhole(remember, 1, 90)
  const valid = t !== null && m !== null && r !== null

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (t === null || m === null || r === null) return
        setSession({ timeoutMinutes: t, maxConcurrent: m, rememberDays: r })
        onDone()
      }}
    >
      <NumberField label="Session timeout" value={timeout} onChange={setTimeoutText} suffix="minutes idle" error={t === null && 'Enter 5 to 480 minutes.'} />
      <NumberField label="Max concurrent sessions" value={max} onChange={setMax} suffix="per user" error={m === null && 'Enter a number from 1 to 10.'} />
      <NumberField label="Remember device window" value={remember} onChange={setRemember} suffix="days" error={r === null && 'Enter 1 to 90 days.'} />
      <Actions onCancel={onDone} disabled={!valid} />
    </form>
  )
}
