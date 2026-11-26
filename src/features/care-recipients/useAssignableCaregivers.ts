/**
 * The assignable caregivers source for the Care Team Reassign screen, read from
 * the backend directory (`GET /admin/caregivers`). `id` is the caregiver profile
 * id (for the detail link); `userId` is the identity id the assign and reassign
 * writes key on, and the one the team membership is compared by.
 *
 * The directory takes only status and paging (no search), so the page filters
 * client side; this fetches one large page of active caregivers.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface CaregiverRowDto {
  id: string
  userId: string
  reference: string
  name: string
  title: string | null
  branch: string | null
  employmentType: string | null
  status: string
}

interface CaregiverListDto {
  total: number
  page: number
  pageSize: number
  rows: CaregiverRowDto[]
}

export interface AssignableCaregiver {
  id: string
  userId: string
  reference: string
  name: string
  title: string | null
  branch: string | null
  status: string
}

const PAGE_SIZE = 100

export function useAssignableCaregivers(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'caregivers', 'assignable'] as const,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<AssignableCaregiver[]> => {
      const dto = await api.get<CaregiverListDto>(
        `/admin/caregivers?status=ACTIVE&page=1&pageSize=${PAGE_SIZE}`,
      )
      return dto.rows
    },
  })
}
