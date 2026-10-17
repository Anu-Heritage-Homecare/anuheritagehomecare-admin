import { TODAY } from '@/lib/today'
import { recipients } from '@/features/care-recipients/data'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import { planById } from './data'
import type { BillingAccount } from './accounts'
import { accountDocuments } from './documents'
import { billingActivity } from './ledger'
import type { ActivityKind } from './ledger'

export type AccountEventKind = ActivityKind | 'opened' | 'recipient' | 'document'

export interface AccountEvent {
  id: string
  kind: AccountEventKind
  /** ISO date. The fixtures carry no time of day. */
  at: string
  title: string
  detail: string
  /** Left out where the records do not say. */
  actor?: string
}

/** Within one day, what needs attention first, the account's own history last. */
const rank: Record<AccountEventKind, number> = {
  overdue: 0,
  failed: 1,
  payment: 2,
  reminder: 3,
  issued: 4,
  document: 5,
  recipient: 6,
  opened: 7,
}

/**
 * Billing and care history for one account, newest first. The billing half is
 * the same feed the dashboard reads, filtered to this account; the care half
 * comes from when each recipient started, the documents on file and the date
 * the account opened. Nothing here is written — every line is read off a
 * record that already exists.
 */
export function accountActivity(
  account: BillingAccount,
  limit = Infinity,
  today = TODAY,
): AccountEvent[] {
  const events: AccountEvent[] = billingActivity(Infinity, today, account.id)

  if (account.openedAt) {
    events.push({
      id: `open-${account.id}`,
      kind: 'opened',
      at: account.openedAt,
      title: 'Account opened',
      detail: `${account.ref} opened with ${account.contact} as primary contact`,
    })
  }

  for (const m of account.members ?? []) {
    events.push({
      id: `rec-${m.name}`,
      kind: 'recipient',
      at: m.startedAt,
      title: 'Care recipient added',
      detail: `${m.name} (${m.relationship.toLowerCase()}) started on the ${planById[m.planId].name}`,
    })
  }

  if (account.recipientId && account.subscription) {
    const r = recipients.find((x) => x.id === account.recipientId)
    const started = getRecipientProfile(account.recipientId)?.summary.startDateIso
    if (r && started) {
      events.push({
        id: `rec-${r.id}`,
        kind: 'recipient',
        at: started,
        title: 'Care started',
        detail: `${r.name} started on the ${planById[account.subscription.planId].name}`,
      })
    }
  }

  for (const d of accountDocuments(account.id)) {
    events.push({
      id: `doc-${d.id}`,
      kind: 'document',
      at: d.uploadedAt,
      title: 'Document uploaded',
      detail: `${d.title} (${d.fileName})`,
    })
  }

  return events
    .filter((e) => e.at <= today)
    .sort((a, b) => b.at.localeCompare(a.at) || rank[a.kind] - rank[b.kind])
    .slice(0, limit)
}
