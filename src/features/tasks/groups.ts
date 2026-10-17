/**
 * Who a template is for.
 *
 * The design assigns a template to a group rather than a person — "All
 * Caregivers", "Certified Staff Only", "Care Managers" — which is right: a
 * checklist for the morning round belongs to whoever is on the round, not to
 * one named caregiver.
 *
 * Every group here is a rule over the roster, not a list somebody typed. That
 * matters twice: the count beside a group is true at the moment it is read, and
 * a new hire lands in the right groups without anybody maintaining them. The
 * rule is stated on each group so the screen can show it rather than expecting
 * the reader to guess what "senior" means.
 */
import { staffMembers } from '@/features/caregivers/staff'
import type { StaffMember } from '@/features/caregivers/staff'
import {
  credentialStates,
  tenureYears,
} from '@/features/caregivers/roster-data'

export type StaffGroupId =
  | 'all-staff'
  | 'all-caregivers'
  | 'certified-staff'
  | 'senior-caregivers'
  | 'care-managers'

export interface StaffGroup {
  id: StaffGroupId
  label: string
  /** The rule, in words, for the form that offers it. */
  rule: string
  matches: (member: StaffMember) => boolean
}

/** Out on visits, as against running the office. */
function onTheRound(member: StaffMember): boolean {
  return !/coordinator|manager/i.test(member.title)
}

/** Five years all in — what they brought with them plus what they have done here. */
const SENIOR_YEARS = 5

export const staffGroups: StaffGroup[] = [
  {
    id: 'all-caregivers',
    label: 'All Caregivers',
    rule: 'Everyone who goes out on visits',
    matches: (m) => m.status === 'active' && onTheRound(m),
  },
  {
    id: 'certified-staff',
    label: 'Certified Staff Only',
    rule: 'Caregivers holding a licence that has not lapsed',
    matches: (m) =>
      m.status === 'active' &&
      onTheRound(m) &&
      credentialStates(m).some(
        (c) => c.credential.kind === 'licence' && c.state !== 'expired',
      ),
  },
  {
    id: 'senior-caregivers',
    label: 'Senior Caregivers',
    rule: `Caregivers with ${SENIOR_YEARS} years or more behind them`,
    matches: (m) =>
      m.status === 'active' &&
      onTheRound(m) &&
      tenureYears(m) + m.priorExperienceYears >= SENIOR_YEARS,
  },
  {
    id: 'care-managers',
    label: 'Care Managers',
    rule: 'Coordinators and managers in the office',
    matches: (m) => m.status === 'active' && !onTheRound(m),
  },
  {
    id: 'all-staff',
    label: 'All Staff',
    rule: 'Everybody on the roster',
    matches: (m) => m.status === 'active',
  },
]

export function groupById(id: StaffGroupId): StaffGroup {
  return (
    staffGroups.find((g) => g.id === id) ?? staffGroups[staffGroups.length - 1]
  )
}

export function groupLabel(id: StaffGroupId): string {
  return groupById(id).label
}

/** The people in it, right now. Named, so a task raised can land on one. */
export function membersOfGroup(id: StaffGroupId): StaffMember[] {
  return staffMembers.filter(groupById(id).matches)
}
