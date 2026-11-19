/**
 * Provisions a caregiver account and profile (`POST /admin/caregivers`). The
 * drawer owns busy and error state; on success the roster is invalidated so the
 * new staff member appears. The response carries a one time temporary password
 * the back office must hand to the caregiver: it is shown once and never stored
 * in plaintext, so the caller must surface it before closing.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ProvisionCaregiverBody {
  firstName: string
  lastName: string
  email: string
  phone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: 'US' | 'NG'
  gender?: 'MALE' | 'FEMALE'
  title?: string
  branch?: string
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT'
}

export interface ProvisionedCaregiver {
  profileId: string
  userId: string
  temporaryPassword: string
}

export function useProvisionCaregiver() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ProvisionCaregiverBody) =>
      api.post<ProvisionedCaregiver>('/admin/caregivers', body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'caregivers', 'roster'] }),
  })
}
