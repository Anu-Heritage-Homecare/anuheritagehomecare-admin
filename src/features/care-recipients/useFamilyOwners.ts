/**
 * The family owners picker source for the Add Care Recipient drawer. Each family
 * row's `id` is the owner user id, used directly as the recipient's `ownerId`.
 *
 * The backend `GET /admin/families` directory takes only status and paging, no
 * search param, so the drawer pages through and filters by name, reference,
 * phone or email on the client.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface FamilyRowDto {
  id: string
  reference: string
  name: string
  phone: string | null
  email: string | null
}

interface FamilyListDto {
  total: number
  page: number
  pageSize: number
  rows: FamilyRowDto[]
}

export interface FamilyOwnerOption {
  id: string
  reference: string
  name: string
  phone: string | null
  email: string | null
}

const PAGE_SIZE = 100

export function useFamilyOwners(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'families', 'owner-picker'] as const,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<FamilyOwnerOption[]> => {
      const dto = await api.get<FamilyListDto>(
        `/admin/families?page=1&pageSize=${PAGE_SIZE}`,
      )
      return dto.rows
    },
  })
}
