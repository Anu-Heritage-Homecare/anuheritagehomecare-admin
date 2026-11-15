/**
 * The data the Schedule Visit form needs: the care recipient picker (from the
 * admin care recipients list) and the fixed visit type vocabulary the backend
 * accepts. Visit types are the backend `VisitType` enum; their labels are the
 * human wording the form shows.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface RecipientItemDto {
  id: string
  code: string
  name: string
  primaryCondition: string | null
  careLevel: string | null
  assignedCaregiverName: string | null
  status: string
}

interface RecipientListDto {
  items: RecipientItemDto[]
}

/** One care recipient option for the picker and summary card. */
export interface RecipientOption {
  id: string
  code: string
  name: string
  condition: string
  careLevel: string
  caregiver: string | null
  status: string
}

/** The backend visit types and the labels the form shows. The value is the enum. */
export const visitTypeOptions: { value: string; label: string }[] = [
  { value: 'PERSONAL_CARE', label: 'Personal Care' },
  { value: 'MORNING_CARE', label: 'Morning Care' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'PHYSICAL_THERAPY', label: 'Physical Therapy' },
  { value: 'WOUND_CARE', label: 'Wound Care' },
  { value: 'COMPANIONSHIP', label: 'Companionship' },
]

/** The care recipients that a visit can be booked for. */
export function useRecipientOptions() {
  return useQuery({
    queryKey: ['admin', 'scheduling', 'recipient-options'],
    queryFn: async (): Promise<RecipientOption[]> => {
      const dto = await api.get<RecipientListDto>('/admin/care-recipients?pageSize=200')
      return dto.items.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        condition: r.primaryCondition ?? '—',
        careLevel: r.careLevel ?? '—',
        caregiver: r.assignedCaregiverName,
        status: r.status,
      }))
    },
  })
}
