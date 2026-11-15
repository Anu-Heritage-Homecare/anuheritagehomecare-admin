/**
 * The Schedule Settings screen: business hours, default visit durations,
 * scheduling rules, travel and buffer, and the holiday calendar, from
 * GET /admin/scheduling/settings with PUT and holiday add/remove mutations.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface BusinessHourDay {
  weekday: string
  weekdayLabel: string
  open: boolean
  openMinute: number
  closeMinute: number
  openLabel: string
  closeLabel: string
}

export interface DefaultDuration {
  visitType: string
  label: string
  minutes: number
}

export interface SchedulingRules {
  requireCertificationMatch: boolean
  autoAssignPreferredCaregiver: boolean
  allowOvertimeScheduling: boolean
  requireCoordinatorApprovalForUrgent: boolean
  sendRemindersOneHourBefore: boolean
  autoCancelUnconfirmedAfter24h: boolean
}

export interface TravelSettings {
  minBufferMinutes: number
  travelTimeEstimation: boolean
  maxTravelDistanceMiles: number
  allowBackToBackVisits: boolean
}

export interface Holiday {
  id: string
  name: string
  date: string
  policy: string
  policyLabel: string
}

export interface SchedulingSettingsView {
  businessHours: BusinessHourDay[]
  defaultDurations: DefaultDuration[]
  rules: SchedulingRules
  travel: TravelSettings
  holidays: Holiday[]
}

export interface UpdateSettingsInput {
  businessHours?: { weekday: string; open: boolean; openMinute: number; closeMinute: number }[]
  defaultDurations?: { visitType: string; minutes: number }[]
  rules?: SchedulingRules
  travel?: TravelSettings
}

export interface AddHolidayInput {
  name: string
  date: string
  policy: string
}

/** The Schedule Settings screen data. */
export function useSchedulingSettings() {
  return useQuery({
    queryKey: ['admin', 'scheduling', 'settings'],
    queryFn: () => api.get<SchedulingSettingsView>('/admin/scheduling/settings'),
  })
}

/** Save, add holiday, remove holiday; each refreshes the settings query. */
export function useSchedulingSettingsMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'scheduling', 'settings'] })

  const save = useMutation({
    mutationFn: (input: UpdateSettingsInput) => api.put<void>('/admin/scheduling/settings', input),
    onSuccess: invalidate,
  })

  const addHoliday = useMutation({
    mutationFn: (input: AddHolidayInput) =>
      api.post<{ id: string }>('/admin/scheduling/settings/holidays', input),
    onSuccess: invalidate,
  })

  const removeHoliday = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/scheduling/settings/holidays/${id}`),
    onSuccess: invalidate,
  })

  return { save, addHoliday, removeHoliday }
}
