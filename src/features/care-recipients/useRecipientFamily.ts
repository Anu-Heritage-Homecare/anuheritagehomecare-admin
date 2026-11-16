/**
 * The Family tab, fetched from the backend and mapped into the `FamilyRecord`
 * the family panels already render (`GET /admin/care-recipients/:id/family`).
 *
 * The tab's helpers (`memberWithRole`, `recentLog`, `lastContact`) run over the
 * mapped `FamilyMember[]` and `CommunicationEntry[]`, so the mapping targets
 * those exact shapes. Backend role, access level, preferred channel and
 * communication type strings are narrowed to the UI unions; an unknown value
 * falls back to the safest option rather than being invented.
 *
 * The communication log carries no inbound/outbound direction, so every mapped
 * entry is `outbound` (the office reaching the family) — the direction only
 * drives an unread derivation the Family tab does not show.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  AccessLevel,
  CommunicationEntry,
  CommunicationType,
  ContactChannel,
  FamilyMember,
  FamilyRecord,
  FamilyRole,
} from './family-data'

/* --------------------------- backend response ----------------------------- */

interface ContactDto {
  id: string
  name: string
  relationship: string
  tier: string | null
  roles: string[]
  roleNote: string | null
  phone: string | null
  email: string | null
  address: string | null
  accessLevel: string
  accessScopeLabel: string | null
  preferredMethod: string | null
  lastContactAt: string | null
  lastContactType: string | null
}

interface CommunicationDto {
  id: string
  familyMemberName: string
  type: string
  subject: string
  staffMemberName: string
  occurredAt: string
}

export interface FamilyDto {
  summary: {
    primaryContact: { name: string | null; relationship: string | null }
    emergencyContact: { name: string | null; relationship: string | null }
    powerOfAttorney: { name: string | null; relationship: string | null }
    totalMembers: number
  }
  contacts: ContactDto[]
  communicationLog: CommunicationDto[]
  permissionsMatrix: {
    familyMemberName: string
    accessLevel: string
    authorizedSectionsLabel: string | null
    portalLoginEnabled: boolean
  }[]
}

/* -------------------------------- helpers --------------------------------- */

const FAMILY_ROLES: FamilyRole[] = [
  'Primary Contact',
  'Emergency Contact',
  'Power of Attorney',
  'Billing Contact',
  'Secondary Contact',
  'Visit Companion',
  'Medical Decision Backup',
]

/** Backend role labels line up with the UI labels; keep only the known ones. */
function toRoles(roles: string[]): FamilyRole[] {
  return roles
    .map((r) => FAMILY_ROLES.find((role) => role.toLowerCase() === r.toLowerCase()))
    .filter((r): r is FamilyRole => r !== undefined)
}

function toAccess(value: string): AccessLevel {
  switch (value.toUpperCase()) {
    case 'FULL':
      return 'full'
    case 'LIMITED':
      return 'limited'
    default:
      return 'view'
  }
}

const CHANNELS: ContactChannel[] = [
  'Phone',
  'App message',
  'SMS text',
  'Email',
  'Video call',
]

function toChannel(value: string | null): ContactChannel {
  if (value === null) return 'Phone'
  return CHANNELS.find((c) => c.toLowerCase() === value.toLowerCase()) ?? 'Phone'
}

const COMM_TYPES: CommunicationType[] = [
  'App Message',
  'Phone Call',
  'In-Person',
  'Email',
  'Video Call',
]

function toCommType(value: string): CommunicationType {
  return COMM_TYPES.find((t) => t.toLowerCase() === value.toLowerCase()) ?? 'App Message'
}

/* -------------------------------- mappers --------------------------------- */

function toMember(
  dto: ContactDto,
  portalByName: Map<string, boolean>,
): FamilyMember {
  return {
    id: dto.id,
    name: dto.name,
    relationship: dto.relationship,
    phone: dto.phone ?? '—',
    email: dto.email ?? '—',
    location: dto.address ?? undefined,
    roles: toRoles(dto.roles),
    access: toAccess(dto.accessLevel),
    preferred: toChannel(dto.preferredMethod),
    portalEnabled: portalByName.get(dto.name) ?? false,
  }
}

function toEntry(dto: CommunicationDto, memberByName: Map<string, string>): CommunicationEntry {
  return {
    id: dto.id,
    at: dto.occurredAt.slice(0, 10),
    memberId: memberByName.get(dto.familyMemberName) ?? dto.familyMemberName,
    type: toCommType(dto.type),
    subject: dto.subject,
    staff: dto.staffMemberName,
    direction: 'outbound',
  }
}

function toRecord(dto: FamilyDto): FamilyRecord {
  const portalByName = new Map(
    dto.permissionsMatrix.map((p) => [p.familyMemberName, p.portalLoginEnabled]),
  )
  const members = dto.contacts.map((c) => toMember(c, portalByName))
  const memberByName = new Map(members.map((m) => [m.name, m.id]))
  return {
    members,
    log: dto.communicationLog.map((e) => toEntry(e, memberByName)),
  }
}

export function useRecipientFamily(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'family'] as const,
    enabled: id !== undefined,
    queryFn: async () =>
      toRecord(await api.get<FamilyDto>(`/admin/care-recipients/${id}/family`)),
  })
}
