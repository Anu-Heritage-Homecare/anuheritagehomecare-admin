/**
 * Organisation settings — the legal identity, the hours the office keeps, its
 * branches and who to ring in an emergency. Now wired to the back office
 * (`GET/PATCH/PUT/POST/DELETE /admin/organization`), mapped into the shapes the
 * page already renders.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface OrgProfile {
  name: string
  registration: string
  /** One line per row, as it is shown. */
  address: string
  timezone: string
  language: string
  currency: string
  dateFormat: string
}

export interface OrgDayHours {
  day: string
  open: boolean
  /** 24-hour "HH:MM". */
  start: string
  end: string
}

export interface Branch {
  id: string
  name: string
  /** Street address as the table shows it: line 1, then line 2 if there is one. */
  address: string
  manager: string
  active: boolean
  /* Collected by the Add Branch drawer; the three branches the design lists
     were drawn without them. */
  city?: string
  state?: string
  phone?: string
  hours?: OrgDayHours[]
}

export const nigerianStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River',
  'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna',
  'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

/** What the Add Branch drawer opens with: 8 to 6, Monday to Saturday. */
export function defaultBranchHours(): OrgDayHours[] {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => ({
    day,
    open: day !== 'Sunday',
    start: '08:00',
    end: '18:00',
  }))
}

export type ContactKind = 'medical' | 'security'

export interface EmergencyContact {
  id: string
  name: string
  role: string
  phone: string
  kind: ContactKind
}

export interface OrganizationSettings {
  profile: OrgProfile
  hours: OrgDayHours[]
  branches: Branch[]
  contacts: EmergencyContact[]
}

export const timezoneOptions = ['WAT (UTC+1)', 'GMT (UTC+0)', 'CAT (UTC+2)', 'EAT (UTC+3)']
export const languageOptions = ['English (UK)', 'English (US)']
/* Naira only: every amount in the app is naira and nothing converts. */
export const currencyOptions = ['₦ Nigerian Naira (NGN)']
export const dateFormatOptions = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

/** "07:00" → "7:00 AM". */
export function formatHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** A day's hours are usable when it closes after it opens. */
export function validHours(h: OrgDayHours): boolean {
  return !h.open || (h.start !== '' && h.end !== '' && h.start < h.end)
}

/** Digits, spaces and a leading +, 7–15 digits in all. */
export function validPhone(phone: string): boolean {
  const digits = phone.replace(/[\s-]/g, '')
  return /^\+?\d{7,15}$/.test(digits)
}

/* ---------------------------- backend response ---------------------------- */

interface DayHoursDto {
  dayOfWeek: number
  isOpen: boolean
  openMinute: number
  closeMinute: number
}

interface BranchDto {
  id: string
  name: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  phone: string | null
  managerId: string | null
  managerName: string | null
  status: string
  businessHours: DayHoursDto[]
}

interface EmergencyContactDto {
  id: string
  name: string
  role: string | null
  phone: string
}

interface OrganizationDto {
  legalName: string | null
  businessRegNumber: string | null
  registeredAddress: string | null
  timezone: string | null
  systemLanguage: string | null
  currency: string
  dateFormat: string | null
  businessHours: DayHoursDto[]
  branches: BranchDto[]
  emergencyContacts: EmergencyContactDto[]
}

/* -------------------------------- mapping --------------------------------- */

// The page's hours list reads Monday first; the backend indexes 0 = Sunday.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PAGE_ORDER = [1, 2, 3, 4, 5, 6, 0] // Monday..Sunday as the page expects.

/** Minutes from midnight to 24-hour "HH:MM". */
function toClock(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 24-hour "HH:MM" to minutes from midnight. */
function toMinute(clock: string): number {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}

/** A backend hours array (any order) to the page's Monday..Sunday OrgDayHours. */
function toDayHours(days: DayHoursDto[]): OrgDayHours[] {
  const byDay = new Map(days.map((d) => [d.dayOfWeek, d]))
  return PAGE_ORDER.map((index) => {
    const d = byDay.get(index)
    return {
      day: DAY_NAMES[index],
      open: d?.isOpen ?? false,
      start: toClock(d?.openMinute ?? 480),
      end: toClock(d?.closeMinute ?? 1080),
    }
  })
}

/** The page's OrgDayHours (Monday..Sunday) to the backend's seven-day array. */
function fromDayHours(hours: OrgDayHours[]): DayHoursDto[] {
  return hours.map((h) => ({
    dayOfWeek: DAY_NAMES.indexOf(h.day),
    isOpen: h.open,
    openMinute: toMinute(h.start),
    closeMinute: toMinute(h.end),
  }))
}

// The UI's medical/security split only drives an icon. The backend has no such
// field, so it is inferred from the role text; everything else reads as medical.
function toKind(role: string | null): ContactKind {
  return role !== null && role.toLowerCase().includes('security') ? 'security' : 'medical'
}

function toBranch(b: BranchDto): Branch {
  return {
    id: b.id,
    name: b.name,
    address: [b.addressLine1, b.addressLine2].filter(Boolean).join(', '),
    manager: b.managerName ?? '',
    active: b.status === 'ACTIVE',
    city: b.city,
    state: b.state,
    phone: b.phone ?? undefined,
    hours: toDayHours(b.businessHours),
  }
}

function toView(dto: OrganizationDto): OrganizationSettings {
  return {
    profile: {
      name: dto.legalName ?? '',
      registration: dto.businessRegNumber ?? '',
      address: dto.registeredAddress ?? '',
      timezone: dto.timezone ?? '',
      language: dto.systemLanguage ?? '',
      // Naira is the only option the screen offers; show its label when set.
      currency: dto.currency === 'NGN' ? '₦ Nigerian Naira (NGN)' : dto.currency,
      dateFormat: dto.dateFormat ?? '',
    },
    hours: toDayHours(dto.businessHours),
    branches: dto.branches.map(toBranch),
    contacts: dto.emergencyContacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role ?? '',
      phone: c.phone,
      kind: toKind(c.role),
    })),
  }
}

const ORG_KEY = ['admin', 'organization'] as const

export function useOrganization() {
  return useQuery({
    queryKey: ORG_KEY,
    queryFn: async () => toView(await api.get<OrganizationDto>('/admin/organization')),
  })
}

/* -------------------------------- writes ---------------------------------- */

/** The profile fields the Edit Profile form sends. Currency maps back to the enum. */
export interface ProfileUpdate {
  legalName: string
  businessRegNumber: string
  registeredAddress: string
  timezone: string
  systemLanguage: string
  dateFormat: string
}

export interface NewBranch {
  name: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  phone?: string
  businessHours: OrgDayHours[]
}

export interface NewContact {
  name: string
  role: string
  phone: string
}

export function useOrganizationMutations() {
  const queryClient = useQueryClient()
  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ORG_KEY })

  const updateProfile = useMutation({
    mutationFn: (profile: ProfileUpdate) =>
      api.patch<OrganizationDto>('/admin/organization', profile),
    onSuccess: invalidate,
  })

  const setBusinessHours = useMutation({
    mutationFn: (hours: OrgDayHours[]) =>
      api.put<OrganizationDto>('/admin/organization/business-hours', {
        days: fromDayHours(hours),
      }),
    onSuccess: invalidate,
  })

  const addBranch = useMutation({
    mutationFn: (branch: NewBranch) =>
      api.post<OrganizationDto>('/admin/organization/branches', {
        name: branch.name,
        addressLine1: branch.addressLine1,
        addressLine2: branch.addressLine2 || undefined,
        city: branch.city,
        state: branch.state,
        phone: branch.phone || undefined,
        businessHours: fromDayHours(branch.businessHours),
      }),
    onSuccess: invalidate,
  })

  const deleteBranch = useMutation({
    mutationFn: (id: string) =>
      api.delete<OrganizationDto>(`/admin/organization/branches/${id}`),
    onSuccess: invalidate,
  })

  const addContact = useMutation({
    mutationFn: (contact: NewContact) =>
      api.post<OrganizationDto>('/admin/organization/emergency-contacts', {
        name: contact.name,
        role: contact.role || undefined,
        phone: contact.phone,
      }),
    onSuccess: invalidate,
  })

  const deleteContact = useMutation({
    mutationFn: (id: string) =>
      api.delete<OrganizationDto>(`/admin/organization/emergency-contacts/${id}`),
    onSuccess: invalidate,
  })

  return { updateProfile, setBusinessHours, addBranch, deleteBranch, addContact, deleteContact }
}
