import { Link } from 'react-router-dom'
import { Drawer } from '@/components/ui/Drawer'
import { tonePill } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { accountRecipients } from './accounts'
import { formatMoney } from './data'
import {
  accountStatement,
  accountStatusLabels,
  accountStatusTones,
  accountTotals,
  statementStatusLabels,
  statementStatusTones,
} from './ledger'
import type { AccountSummary } from './ledger'

const pill = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap'
const heading = 'text-ink-subtle text-xs font-semibold tracking-wide uppercase'
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmt = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`))

/** The Account Preview side panel on the Billing Accounts list. */
export function AccountPreviewDrawer({
  summary,
  onClose,
  from,
}: {
  summary: AccountSummary | undefined
  onClose: () => void
  /** Where Create Invoice returns to. */
  from: string
}) {
  return (
    <Drawer open={Boolean(summary)} onClose={onClose} title="Account Preview">
      {summary && <Preview summary={summary} from={from} />}
    </Drawer>
  )
}

function Preview({ summary: s, from }: { summary: AccountSummary; from: string }) {
  const a = s.account
  const statement = accountStatement(a)
  const totals = accountTotals(statement)
  const recent = statement.filter((l) => l.kind === 'invoice').slice(0, 3)
  const people = accountRecipients(a).map((r) => {
    const rel = a.members?.find((m) => m.name === r.name)?.relationship
    return rel && rel !== 'Self' ? `${r.name} (${rel})` : r.name
  })
  const contact = [a.email, a.phone].filter((x) => x !== 'Not recorded')

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-6 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-ink text-xl font-bold tracking-tight">{a.name} Account</h3>
            <span className={cn(pill, tonePill[accountStatusTones[s.status]])}>{accountStatusLabels[s.status]}</span>
          </div>
          <p className="text-ink-subtle mt-1 text-xs">REF: {a.ref}</p>
        </div>

        <section className="bg-sunken/60 rounded-xl p-4">
          <h4 className={heading}>Primary Contact</h4>
          <p className="text-ink mt-2 font-semibold">{a.contact}</p>
          {contact.map((c) => (
            <p key={c} className="text-ink-muted text-sm break-words">
              {c}
            </p>
          ))}
        </section>

        <section>
          <h4 className={heading}>Financial Summary</h4>
          <dl className="divide-line mt-2 divide-y text-sm">
            <div className="flex justify-between gap-4 px-2.5 py-3">
              <dt className="text-ink-muted">Outstanding</dt>
              <dd className={cn('font-bold tabular-nums', s.outstanding > 0 ? 'text-red-600' : 'text-ink')}>
                {formatMoney(s.outstanding)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 px-2.5 py-3">
              <dt className="text-ink-muted">Total Billed</dt>
              <dd className="text-ink font-bold tabular-nums">{formatMoney(totals.billed)}</dd>
            </div>
            <div className="flex justify-between gap-4 px-2.5 py-3">
              <dt className="text-ink-muted">Last Payment</dt>
              <dd className={cn('font-semibold', s.lastPaymentAt ? 'text-emerald-600' : 'text-ink-subtle')}>
                {s.lastPaymentAt ? fmt(s.lastPaymentAt) : 'None recorded'}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h4 className={heading}>Linked Recipients</h4>
          {people.length === 0 ? (
            <p className="text-ink-subtle mt-2 text-sm">No care recipient is linked to this account.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {people.map((p) => (
                <li key={p} className="text-ink flex items-center gap-2.5 text-sm">
                  <span aria-hidden="true" className="bg-brand-600 size-1.5 shrink-0 rounded-full" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className={heading}>Recent Invoices</h4>
          {recent.length === 0 ? (
            <p className="text-ink-subtle mt-2 text-sm">
              {a.subscription && !a.subscription.invoiceBilled
                ? 'Billed by card renewal — no invoices.'
                : 'No invoices yet.'}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {recent.map((l) => (
                <li key={l.ref}>
                  <Link
                    to={`/billing/invoices/${l.ref}`}
                    className="border-line hover:bg-sunken/40 flex items-center gap-3 rounded-lg border px-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-ink block text-sm font-semibold">{l.ref}</span>
                      <span className="text-ink-subtle block text-xs">
                        {l.paidAt ? `Paid ${fmt(l.paidAt)}` : `Due ${fmt(l.dueAt)}`}
                      </span>
                    </span>
                    <span className="text-ink text-sm font-bold tabular-nums">{formatMoney(l.amount)}</span>
                    <span className={cn(pill, tonePill[statementStatusTones[l.status]])}>
                      {statementStatusLabels[l.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="border-line bg-surface sticky bottom-0 space-y-3 border-t p-5">
        <Link
          to={`/billing/accounts/${a.id}`}
          className="bg-brand-600 hover:bg-brand-700 flex h-11 items-center justify-center rounded-lg text-sm font-semibold text-white"
        >
          View Full Account
        </Link>
        <Link
          to={`/billing/invoices/new?account=${a.id}&from=${encodeURIComponent(from)}`}
          className="border-brand-500 text-brand-600 hover:bg-brand-50 flex h-11 items-center justify-center rounded-lg border text-sm font-semibold"
        >
          Create Invoice
        </Link>
      </div>
    </div>
  )
}
