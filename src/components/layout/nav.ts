import {
  Activity,
  BarChart3,
  CalendarDays,
  CreditCard,
  Heart,
  House,
  MessageSquare,
  Settings,
  SquareCheck,
  UserRound,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavChild {
  label: string
  to: string
  /** Match the parent's own path exactly; children own their subtrees. */
  end?: boolean
}

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  children?: NavChild[]
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: House },
  {
    label: 'Care Recipients',
    to: '/care-recipients',
    icon: Users,
    /*
     * Intake and the directory are the same section: a care request becomes a
     * recipient the moment it is approved, and coordinators move between the
     * two all day.
     */
    children: [
      { label: 'Directory', to: '/care-recipients', end: true },
      { label: 'Care Requests', to: '/care-recipients/requests' },
    ],
  },
  { label: 'Families', to: '/families', icon: Heart },
  { label: 'Caregivers', to: '/caregivers', icon: UserRound },
  {
    label: 'Scheduling',
    to: '/scheduling',
    icon: CalendarDays,
    /*
     * The rules that govern the board belong beside it, not buried in
     * organisation-wide Settings — a coordinator changing business hours is
     * doing scheduling work, not administration.
     */
    children: [
      { label: 'Board', to: '/scheduling', end: true },
      { label: 'Schedule Settings', to: '/scheduling/settings' },
    ],
  },
  {
    label: 'Live Monitoring',
    to: '/live-monitoring',
    icon: Activity,
    /*
     * Two different things, which were one view switcher until it became clear
     * they are not the same list. The board's views are all lists of *visits*
     * — happening now, all of today, on a map. Alerts are a different entity
     * entirely: they come from medication plans, care notes and the scheduling
     * board as well as from visits, and one alert can outlive the visit that
     * raised it. Filing them as a fourth "view" of the board put a list of
     * alerts behind a control whose other options were lists of visits.
     */
    children: [
      { label: 'Board', to: '/live-monitoring', end: true },
      { label: 'Alerts & Incidents', to: '/live-monitoring/alerts' },
      // Three tenses, one section: right now, today, and days that have
      // finished. History was reachable from nowhere before this — no link, no
      // route, no page.
      { label: 'Monitoring History', to: '/live-monitoring/history' },
    ],
  },
  {
    label: 'Tasks',
    to: '/tasks',
    icon: SquareCheck,
    /*
     * Templates are not listed here: the Tasks page opens them, from the header
     * button and from Quick Operations, and a nav entry for a screen one click
     * away only lengthens the rail.
     */
    children: [
      { label: 'All Tasks', to: '/tasks', end: true },
      { label: 'Task Settings', to: '/tasks/settings' },
    ],
  },
  {
    label: 'Messages',
    to: '/messages',
    icon: MessageSquare,
    /*
     * Announcements are not here: they are a folder of the inbox, and the
     * folder rail is where somebody working the inbox looks for them. Settings
     * is, because it is a settings screen rather than a cut of the inbox.
     */
    children: [
      { label: 'Inbox', to: '/messages', end: true },
      { label: 'Message Settings', to: '/messages/settings' },
    ],
  },
  {
    label: 'Billing',
    to: '/billing',
    icon: CreditCard,
    /*
     * The catalogue and the workspace are reachable by drilling down from the
     * overview, but "Create New Plan" and "Bulk Actions" are top-level jobs —
     * nobody should have to route through a dashboard to add a plan.
     */
    children: [
      { label: 'Overview', to: '/billing', end: true },
      { label: 'Accounts', to: '/billing/accounts' },
      { label: 'Invoices', to: '/billing/invoices' },
      { label: 'Credits & Adjustments', to: '/billing/adjustments' },
      { label: 'Financial Reports', to: '/billing/reports' },
      { label: 'Care Plans', to: '/billing/plans' },
      { label: 'Subscriptions', to: '/billing/subscriptions' },
      { label: 'Billing Settings', to: '/billing/settings' },
    ],
  },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Settings', to: '/settings', icon: Settings },
]
