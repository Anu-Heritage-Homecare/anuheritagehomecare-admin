/**
 * The caregiver Documents tab, fetched from the back office API. One request
 * (`GET /admin/caregivers/:id/documents`) powers the whole tab: the compliance
 * summary strip, the certifications and employment document tables, the training
 * records, the upcoming renewals and the upload history timeline.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/* --------------------------- backend response ----------------------------- */

interface ComplianceSummaryDto {
  overallStatus: string
  message: string
  requirementsMet: number
  requirementsTotal: number
  credentialingValidUntil: string | null
  nextImpendingExpiry: { name: string; expiresAt: string; daysRemaining: number } | null
  documentsOnFile: number
  lastUpdated: string | null
}

export interface DocumentsCredentialDto {
  id: string
  name: string
  kind: string
  licenseNumber: string | null
  issued: string | null
  expires: string
  status: string
  fileName: string | null
  hasDocument: boolean
}

export interface DocumentsEmploymentDto {
  id: string
  name: string
  category: string
  status: string
  date: string | null
  fileName: string | null
  hasDocument: boolean
}

export interface DocumentsTrainingDto {
  id: string
  name: string
  status: string
  completed: string | null
  certificate: boolean
  hoursLabel: string
  hasCertificate: boolean
}

interface DocumentsRenewalDto {
  id: string
  name: string
  expiresAt: string
  monthsAway: number
  urgency: 'REQUIRED' | 'UPCOMING' | 'VALID'
  label: string
}

interface DocumentsUploadDto {
  date: string
  title: string
  fileName: string | null
  uploadedBy: string | null
}

export interface DocumentsResponseDto {
  summary: ComplianceSummaryDto
  certifications: DocumentsCredentialDto[]
  employmentDocuments: DocumentsEmploymentDto[]
  trainingRecords: DocumentsTrainingDto[]
  upcomingRenewals: DocumentsRenewalDto[]
  uploadHistory: DocumentsUploadDto[]
}

export type CaregiverDocuments = DocumentsResponseDto

/* --------------------------------- hook ----------------------------------- */

export function useCaregiverDocuments(id: string) {
  return useQuery({
    queryKey: ['admin', 'caregivers', id, 'documents'] as const,
    queryFn: (): Promise<CaregiverDocuments> =>
      api.get<DocumentsResponseDto>(`/admin/caregivers/${id}/documents`),
  })
}
