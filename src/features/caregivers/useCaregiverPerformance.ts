/**
 * The caregiver Performance tab, fetched from the back office API. One request
 * (`GET /admin/caregivers/:id/performance`) powers the whole tab: the four score
 * cards, this month's key metrics, the client feedback spread, the six month
 * trend and history, and the recent reviews.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/* --------------------------- backend response ----------------------------- */

interface ScoreCardsDto {
  overallScore: number | null
  punctualityPercent: number | null
  clientSatisfaction: number | null
  taskCompletionPercent: number | null
}

interface KeyMetricsDto {
  visitsCompleted: number
  hoursLogged: number
  onTimeArrivals: { onTime: number; total: number; percent: number | null }
  missedVisits: number
  lateArrivals: { count: number; averageMinutesLate: number | null }
  earlyDepartures: number
  overtimeHours: number
}

interface ClientFeedbackDto {
  averageRating: number | null
  totalReviews: number
  positiveReviews: number
  neutralReviews: number
  negativeReviews: number
  mostPraisedTraits: string[]
  areasForGrowth: string[]
}

interface TrendPointDto {
  monthLabel: string
  score: number | null
}

interface HistoryRowDto {
  monthLabel: string
  score: number | null
  visits: number
  hours: number
  punctualityPercent: number | null
  csat: number | null
}

export interface PerformanceReviewDto {
  authorName: string | null
  relationship: string | null
  reviewerType: string
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  rating: number
  comment: string | null
  recipientName: string | null
  createdAt: string
}

export interface PerformanceResponseDto {
  periodLabel: string
  scoreCards: ScoreCardsDto
  keyMetrics: KeyMetricsDto
  clientFeedback: ClientFeedbackDto
  trend: TrendPointDto[]
  history: HistoryRowDto[]
  recentReviews: PerformanceReviewDto[]
}

export type CaregiverPerformance = PerformanceResponseDto

/* --------------------------------- hook ----------------------------------- */

export function useCaregiverPerformance(id: string) {
  return useQuery({
    queryKey: ['admin', 'caregivers', id, 'performance'] as const,
    queryFn: (): Promise<CaregiverPerformance> =>
      api.get<PerformanceResponseDto>(`/admin/caregivers/${id}/performance`),
  })
}
