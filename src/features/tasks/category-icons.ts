/**
 * The icons a category can wear.
 *
 * A fixed set, not free text: the design puts a picture beside every category,
 * and a field that accepted anything would either be an emoji box or a name
 * that renders as nothing. Twelve is enough to tell a medication list from a
 * training one at a glance, which is the whole job.
 */
import {
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  HeartHandshake,
  Home,
  Package,
  Pill,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type CategoryIconId =
  | 'home'
  | 'pill'
  | 'clipboard'
  | 'alert'
  | 'settings'
  | 'calendar'
  | 'file'
  | 'training'
  | 'users'
  | 'package'
  | 'shield'
  | 'intake'
  | 'care'

export const categoryIcons: {
  id: CategoryIconId
  label: string
  Icon: LucideIcon
}[] = [
  { id: 'home', label: 'Home visit', Icon: Home },
  { id: 'pill', label: 'Medication', Icon: Pill },
  { id: 'clipboard', label: 'Assessment', Icon: ClipboardList },
  { id: 'alert', label: 'Safety', Icon: TriangleAlert },
  { id: 'settings', label: 'Operations', Icon: Settings },
  { id: 'calendar', label: 'Planning', Icon: CalendarDays },
  { id: 'file', label: 'Paperwork', Icon: FileText },
  { id: 'training', label: 'Training', Icon: GraduationCap },
  { id: 'users', label: 'Family', Icon: Users },
  { id: 'package', label: 'Supplies', Icon: Package },
  { id: 'shield', label: 'Compliance', Icon: ShieldCheck },
  { id: 'intake', label: 'New client', Icon: UserPlus },
  { id: 'care', label: 'Care', Icon: HeartHandshake },
]

export function categoryIcon(id: CategoryIconId): LucideIcon {
  return categoryIcons.find((i) => i.id === id)?.Icon ?? FileText
}
