import { recipients } from '@/features/care-recipients/data'
import {
  getFamilyRecord,
  memberWithRole,
} from '@/features/care-recipients/family-data'
import { getBillingRecord } from '@/features/care-recipients/billing-data'
import { getCaregiverRecord } from '@/features/care-recipients/caregivers-data'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import type { RecipientStatus } from '@/types'
import { branches } from '@/features/caregivers/staff'
import { subscriptions } from './data'
import type { PlanId, Subscription } from './data'

/* ---------------------------------- types --------------------------------- */

export type Branch = (typeof branches)[number]

/**
 * Someone an invoice account pays for who is not in the care recipient
 * directory. Directory recipients are reached through `recipientId` instead.
 */
export interface AccountMember {
  name: string
  /** To the account's primary contact, e.g. "Self", "Father", "Resident". */
  relationship: string
  planId: PlanId
  /** ISO. */
  startedAt: string
  /** The kind of support, e.g. "Dementia Care Support". */
  service: string
  /** The care plan as the service agreement names it. */
  carePlan: string
  /** Name and role, e.g. "Nurse Chioma Nnaji (Registered Nurse)". */
  caregiver: string
  /** The services invoiced for this person. */
  billable: string[]
}

/**
 * Who pays. An account is billed either by invoice (the receivables book in
 * ledger.ts) or by card renewal against a subscription — never both, for the
 * same reason `Subscription.invoiceBilled` exists.
 */
export interface BillingAccount {
  /** Stable slug used in the URL, e.g. `acc-babalola`. */
  id: string
  /** Human-facing reference, e.g. ACC-1004 or ACC-CR-003. Never CP-, which is
   *  the visit reference scheme. */
  ref: string
  /** ISO. When the account was opened, where the fixtures know it. */
  openedAt?: string
  name: string
  contact: string
  phone: string
  /** 'Not recorded' where the family record has none. */
  email: string
  branch: Branch
  /** How many care recipients this account pays for. */
  recipients: number
  /** Invoice accounts only — who `recipients` counts. */
  members?: AccountMember[]
  /** Set for accounts that stand for one directory recipient. */
  recipientId?: string
  /** The payer's relationship to that recipient, as their record states it. */
  contactRelationship?: string
  /** The subscription behind a directory recipient's account. */
  subscription?: Subscription
}

export { branches }

/* ---------------------------------- data ---------------------------------- */

/*
 * Accounts on invoice terms that are not in the eight-person directory — a
 * care home and several families paying for more than one person. The
 * directory's own recipients are added below from their records.
 */
const invoiceAccountSpecs: (Omit<BillingAccount, 'recipients'> & {
  members: AccountMember[]
})[] = [
  {
    id: 'acc-adeyemi',
    ref: 'ACC-1001',
    openedAt: '2025-01-12',
    name: 'Adeyemi Family',
    contact: 'Mrs. Funmilayo Adeyemi',
    phone: '+234 803 111 2222',
    email: 'funmilayo.adeyemi@example.com',
    branch: 'Central Branch',
    members: [
      { name: 'Mrs. Funmilayo Adeyemi', relationship: 'Self', planId: 'premium', startedAt: '2025-01-15',
        service: 'Dementia Care Support', carePlan: 'Full-Time Dementia Care Support',
        caregiver: 'Nurse Chioma Nnaji (Registered Nurse)',
        billable: ['Personal Care', 'Medication Management', 'Physiotherapy', 'Meal Prep'],
      },
      { name: 'Mr. Adeyemi Snr', relationship: 'Father', planId: 'standard', startedAt: '2025-06-01',
        service: 'Elderly Basic Care', carePlan: 'Part-Time Elderly Basic Care',
        caregiver: 'Mr. Tobi Afolabi (Care Assistant)',
        billable: ['Personal Care', 'Companionship', 'Meal Prep'],
      },
    ],
  },
  {
    id: 'acc-okafor',
    ref: 'ACC-1002',
    openedAt: '2025-06-03',
    name: 'Okafor Household',
    contact: 'Mr. Chinedu Okafor',
    phone: '+234 805 333 4444',
    email: 'chinedu.okafor@example.com',
    branch: 'North Branch',
    members: [
      { name: 'Mrs. Ngozi Okafor', relationship: 'Mother', planId: 'premium', startedAt: '2025-06-03',
        service: 'Post-Stroke Rehabilitation', carePlan: 'Full-Time Post-Stroke Rehabilitation',
        caregiver: 'Nurse Adaeze Obi (Registered Nurse)',
        billable: ['Physiotherapy', 'Medication Management', 'Personal Care'],
      },
    ],
  },
  {
    id: 'acc-babalola',
    ref: 'ACC-1003',
    openedAt: '2024-11-20',
    name: 'Babalola Senior Living',
    contact: 'Mrs. Kemi Babalola',
    phone: '+234 809 555 6666',
    email: 'accounts@babalolaseniorliving.example.com',
    branch: 'South Branch',
    members: [
      { name: 'Pa Samuel Ogunleye', relationship: 'Resident', planId: 'premium', startedAt: '2024-11-20',
        service: 'Residential Elderly Care', carePlan: 'Full-Time Residential Care',
        caregiver: 'Nurse Bisi Adewale (Registered Nurse)',
        billable: ['Personal Care', 'Medication Management', 'Meal Prep'],
      },
      { name: 'Mrs. Comfort Adebayo', relationship: 'Resident', planId: 'premium', startedAt: '2024-12-02',
        service: 'Diabetes Management', carePlan: 'Full-Time Residential Care',
        caregiver: 'Nurse Bisi Adewale (Registered Nurse)',
        billable: ['Medication Management', 'Meal Prep', 'Clinical Checkups'],
      },
      { name: 'Mr. Emeka Nwosu', relationship: 'Resident', planId: 'premium', startedAt: '2025-02-10',
        service: 'Mobility Support', carePlan: 'Full-Time Residential Care',
        caregiver: 'Mr. Kunle Ajayi (Care Assistant)',
        billable: ['Personal Care', 'Physiotherapy'],
      },
      { name: 'Mrs. Halima Yusuf', relationship: 'Resident', planId: 'premium', startedAt: '2025-05-19',
        service: 'Dementia Care Support', carePlan: 'Full-Time Residential Care',
        caregiver: 'Nurse Bisi Adewale (Registered Nurse)',
        billable: ['Personal Care', 'Medication Management', 'Companionship'],
      },
      { name: 'Mr. Tunde Bakare', relationship: 'Resident', planId: 'premium', startedAt: '2025-10-06',
        service: 'Residential Elderly Care', carePlan: 'Full-Time Residential Care',
        caregiver: 'Mr. Kunle Ajayi (Care Assistant)',
        billable: ['Personal Care', 'Meal Prep'],
      },
      { name: 'Mrs. Grace Etim', relationship: 'Resident', planId: 'premium', startedAt: '2026-03-02',
        service: 'Post-Surgery Recovery', carePlan: 'Full-Time Residential Care',
        caregiver: 'Nurse Bisi Adewale (Registered Nurse)',
        billable: ['Wound Care', 'Physiotherapy', 'Personal Care'],
      },
    ],
  },
  {
    id: 'acc-bello',
    ref: 'ACC-1004',
    openedAt: '2025-09-08',
    name: 'Bello Trust',
    contact: 'Hajiya Fatima Bello',
    phone: '+234 816 999 0000',
    email: 'fatima.bello@example.com',
    branch: 'Central Branch',
    members: [
      { name: 'Alhaja Hauwa Bello', relationship: 'Mother', planId: 'premium', startedAt: '2025-09-08',
        service: 'Elderly Basic Care', carePlan: 'Full-Time Elderly Basic Care',
        caregiver: 'Mrs. Zainab Lawal (Care Assistant)',
        billable: ['Personal Care', 'Meal Prep', 'Companionship'],
      },
      { name: 'Mallam Sani Bello', relationship: 'Uncle', planId: 'premium', startedAt: '2025-09-08',
        service: 'Hypertension Management', carePlan: 'Full-Time Hypertension Management',
        caregiver: 'Nurse Musa Garba (Registered Nurse)',
        billable: ['Medication Management', 'Clinical Checkups', 'Meal Prep'],
      },
    ],
  },
  {
    id: 'acc-eze',
    ref: 'ACC-1005',
    openedAt: '2026-02-17',
    name: 'Eze Family',
    contact: 'Mrs. Nkechi Eze',
    phone: '+234 703 222 3333',
    email: 'nkechi.eze@example.com',
    branch: 'South Branch',
    members: [
      { name: 'Mr. Obinna Eze', relationship: 'Father', planId: 'premium', startedAt: '2026-02-17',
        service: 'Palliative Care', carePlan: '24-Hour Palliative Care',
        caregiver: 'Nurse Ifeoma Chukwu (Registered Nurse)',
        billable: ['Personal Care', 'Medication Management', 'Pain Management'],
      },
    ],
  },
  {
    id: 'acc-musa',
    ref: 'ACC-1006',
    openedAt: '2025-12-01',
    name: 'Musa Family',
    contact: 'Mr. Ibrahim Musa',
    phone: '+234 802 777 8888',
    email: 'ibrahim.musa@example.com',
    branch: 'North Branch',
    members: [
      { name: 'Hajiya Aisha Musa', relationship: 'Mother', planId: 'premium', startedAt: '2025-12-01',
        service: 'Elderly Basic Care', carePlan: 'Full-Time Elderly Basic Care',
        caregiver: 'Mrs. Zainab Lawal (Care Assistant)',
        billable: ['Personal Care', 'Meal Prep', 'Companionship'],
      },
    ],
  },
]

// Counted from the members, so the two cannot disagree.
const invoiceAccounts: BillingAccount[] = invoiceAccountSpecs.map((a) => ({
  ...a,
  recipients: a.members.length,
}))

/*
 * The branch a directory recipient is served from. Keyed by id, like every
 * other per-recipient fixture, so reordering the directory moves nothing.
 */
const recipientBranch: Record<string, Branch> = {
  'cr-001': 'North Branch',
  'cr-002': 'Central Branch',
  'cr-003': 'North Branch',
  'cr-004': 'South Branch',
  'cr-005': 'Central Branch',
  'cr-006': 'South Branch',
  'cr-007': 'Central Branch',
  'cr-008': 'North Branch',
}

/**
 * One account per directory recipient, paid by whoever their record names:
 * the billing record's guarantor where there is one, else the family's
 * Billing Contact, else their Primary Contact.
 */
const recipientAccounts: BillingAccount[] = recipients.map((r) => {
  const surname = r.name.split(' ').slice(-1)[0]
  const members = getFamilyRecord(r.id)?.members ?? []
  const guarantor = getBillingRecord(r.id)?.contact
  const payer =
    guarantor ??
    memberWithRole(members, 'Billing Contact') ??
    memberWithRole(members, 'Primary Contact')
  return {
    id: `acc-${r.id}`,
    // #CR-003 → ACC-CR-003: stable, and says which recipient it stands for.
    ref: `ACC-${r.ref.replace(/^#/, '')}`,
    name: `${surname} Family`,
    contact: payer?.name ?? 'Not recorded',
    phone: payer?.phone ?? 'Not recorded',
    email: payer?.email ?? 'Not recorded',
    branch: recipientBranch[r.id] ?? 'Central Branch',
    recipients: 1,
    recipientId: r.id,
    contactRelationship: payer?.relationship,
    subscription: subscriptions.find((s) => s.recipientId === r.id),
  }
})

export const billingAccounts: BillingAccount[] = [
  ...invoiceAccounts,
  ...recipientAccounts,
]

const byId = new Map(billingAccounts.map((a) => [a.id, a]))
const byRecipient = new Map(
  recipientAccounts.map((a) => [a.recipientId as string, a]),
)

export function getAccount(id: string): BillingAccount | undefined {
  return byId.get(id)
}

export function accountForRecipient(recipientId: string): BillingAccount | undefined {
  return byRecipient.get(recipientId)
}

/* ------------------------------- recipients -------------------------------- */

/** One person an account pays for, as the invoice wizard shows them. */
export interface AccountRecipient {
  /** Stable within the account: the directory id, or the member's name. */
  key: string
  name: string
  service: string
  carePlan: string
  caregiver: string
  billable: string[]
  status: RecipientStatus
  /** ISO. When their care began, where the record says. */
  startedAt?: string
}

/**
 * Everyone an account pays for. Members carry their care details on the
 * account; a directory recipient's come from their record — condition and
 * care level, the primary caregiver on their team, and the service lines
 * their billing record has charged.
 */
export function accountRecipients(account: BillingAccount): AccountRecipient[] {
  if (account.members) {
    // Members carry no status of their own; they are billed while the
    // account is.
    return account.members.map((m) => ({
      key: m.name,
      name: m.name,
      service: m.service,
      carePlan: m.carePlan,
      caregiver: m.caregiver,
      billable: m.billable,
      status: 'active',
      startedAt: m.startedAt,
    }))
  }
  const r = recipients.find((d) => d.id === account.recipientId)
  if (!r) return []
  const team = getCaregiverRecord(r.id)?.team ?? []
  const lead = team.find((m) => m.primary) ?? team[0]
  const lines = getBillingRecord(r.id)?.services.map((l) => l.label) ?? []
  return [
    {
      key: r.id,
      name: r.name,
      service: r.condition,
      carePlan: `${r.careLevel} ${r.condition} Support`,
      caregiver: lead ? `${lead.name} (${lead.role})` : 'Not assigned',
      billable: lines.length ? lines : ['Home Care Visits'],
      status: r.status,
      startedAt: getRecipientProfile(r.id)?.summary.startDateIso || undefined,
    },
  ]
}
