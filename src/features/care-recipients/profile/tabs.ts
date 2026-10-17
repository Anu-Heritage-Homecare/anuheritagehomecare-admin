import {
  CalendarPlus,
  ClipboardList,
  Download,
  MessageSquare,
  Plus,
  Printer,
  SquarePen,
  Upload,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface ProfileTab {
  slug: string
  label: string
}

export const profileTabs: ProfileTab[] = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'care-plan', label: 'Care Plan' },
  { slug: 'visits', label: 'Visits' },
  { slug: 'health', label: 'Health' },
  { slug: 'medications', label: 'Medications' },
  { slug: 'caregivers', label: 'Caregivers' },
  { slug: 'family', label: 'Family' },
  { slug: 'documents', label: 'Documents' },
  { slug: 'notes', label: 'Notes' },
  { slug: 'billing', label: 'Billing' },
  { slug: 'activity', label: 'Activity' },
]

export interface TabAction {
  label: string
  icon: LucideIcon
  primary?: boolean
  /** Where the button goes, given the recipient's id. Absent: not built yet. */
  to?: (recipientId: string) => string
  /** Prints the page instead of navigating; the browser saves it as a PDF. */
  print?: boolean
}

const defaultActions: TabAction[] = [
  { label: 'Edit Profile', icon: SquarePen, to: (id) => `/care-recipients/${id}/edit` },
  {
    label: 'Schedule Visit',
    icon: CalendarPlus,
    primary: true,
    to: (id) => `/scheduling/visits/new?recipient=${id}`,
  },
]

/** Header buttons change with the active tab; anything unlisted falls back. */
const actionsByTab: Record<string, TabAction[]> = {
  'care-plan': [
    {
      label: 'Edit Care Plan',
      icon: SquarePen,
      primary: true,
      to: (id) => `/care-recipients/${id}/care-plan/edit`,
    },
    { label: 'Print', icon: Printer, print: true },
  ],
  medications: [
    { label: 'View Care Plan', icon: ClipboardList, to: (id) => `/care-recipients/${id}/care-plan` },
    { label: 'Add Medication', icon: Plus, primary: true, to: (id) => `/care-recipients/${id}/medications/new` },
  ],
  health: [
    // Export is left to the backend.
    { label: 'Export', icon: Download },
    { label: 'Add Health Event', icon: Plus, primary: true, to: (id) => `/care-recipients/${id}/health/new` },
  ],
  caregivers: [
    { label: 'Contact Family', icon: MessageSquare, to: (id) => `/care-recipients/${id}/family?contact=1` },
    { label: 'Assign Caregiver', icon: Plus, primary: true, to: (id) => `/care-recipients/${id}/caregivers/assign` },
  ],
  documents: [{ label: 'Upload Document', icon: Upload, primary: true }],
  billing: [
    { label: 'Export', icon: Download },
    { label: 'Create Invoice', icon: Plus, primary: true },
  ],
  notes: [{ label: 'Add Note', icon: Plus, primary: true }],
  family: [
    { label: 'Message All', icon: MessageSquare },
    { label: 'Add Family Member', icon: Plus, primary: true },
  ],
  activity: [{ label: 'Export Audit Trail', icon: Download }],
}

export function actionsForTab(slug: string | undefined): TabAction[] {
  // hasOwn, not a bare lookup — `actionsByTab['constructor']` would otherwise
  // return a function and blow up the caller's .map().
  if (slug && Object.hasOwn(actionsByTab, slug)) return actionsByTab[slug]
  return defaultActions
}
