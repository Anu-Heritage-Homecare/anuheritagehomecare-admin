/**
 * Live Monitoring, fetched from the backend and mapped into the shapes the page
 * renders. Mirrors the dashboard hook: DTO interfaces, a mapper into exported
 * view types, and react-query hooks. The live overview polls, since it is a
 * realtime screen; everything the server already formatted (time labels, status
 * labels) is rendered as given rather than recomputed.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Severity } from '@/types'

/* --------------------------- backend response ----------------------------- */

interface SummaryDto {
  activeVisits: number
  caregiversCheckedIn: number
  checkInDue: number
  runningLate: number
  attentionRequired: number
  criticalAlerts: number
}

interface TabCountsDto {
  activeVisits: number
  attention: number
}

interface OverviewActiveVisitDto {
  visitId: string
  recipientName: string
  caregiverName: string | null
  service: string
  status: string
  elapsedMinutes: number
  elapsedLabel: string
  progressPercent: number
}

interface AttentionDto {
  id: string
  source: string
  issueType: string
  description: string
  priority: string
  timeLabel: string
  recipientName: string | null
  caregiverName: string | null
  visitId: string | null
  primaryAction: string
  secondaryAction: string
}

interface ActivityDto {
  type: string
  title: string
  description: string
  at: string
  timeLabel: string
}

interface OverviewDto {
  updatedAt: string
  summary: SummaryDto
  tabCounts: TabCountsDto
  activeVisits: OverviewActiveVisitDto[]
  attentionRequired: AttentionDto[]
  recentActivity: ActivityDto[]
}

interface ActiveVisitRowDto {
  reference: string
  visitId: string
  recipientName: string
  caregiverName: string | null
  service: string
  checkInTimeLabel: string | null
  status: string
}

interface ActiveVisitCountsDto {
  allActive: number
  checkedIn: number
  inProgress: number
  runningLate: number
  overdue: number
  attention: number
}

interface ActiveVisitPageDto {
  total: number
  page: number
  pageSize: number
  counts: ActiveVisitCountsDto
  rows: ActiveVisitRowDto[]
}

interface MapPointDto {
  visitId: string
  reference: string
  category: 'ACTIVE' | 'RUNNING_LATE'
  recipientName: string
  recipientLatitude: number | null
  recipientLongitude: number | null
  caregiverName: string | null
  caregiverLatitude: number | null
  caregiverLongitude: number | null
  status: string
  recipientAddress: string | null
  caregiverTitle: string | null
  serviceScheduled: string
  checkInTimeLabel: string | null
  lastPingLabel: string | null
  lastPingActive: boolean
}

interface MapCountsDto {
  active: number
  runningLate: number
  sos: number
}

interface MapSosDto {
  id: string
  caregiverName: string | null
  latitude: number | null
  longitude: number | null
}

interface MapDto {
  counts: MapCountsDto
  visits: MapPointDto[]
  sos: MapSosDto[]
}

/* ------------------------------ view types -------------------------------- */

export interface LiveSummary {
  activeVisits: number
  caregiversCheckedIn: number
  checkInDue: number
  runningLate: number
  attentionRequired: number
  criticalAlerts: number
}

export interface LiveActiveVisit {
  visitId: string
  recipientName: string
  caregiverName: string | null
  service: string
  status: string
  elapsedLabel: string
  progressPercent: number
}

export interface LiveAttention {
  id: string
  source: string
  issueType: string
  description: string
  severity: Severity
  timeLabel: string
  recipientName: string | null
  caregiverName: string | null
  visitId: string | null
  primaryAction: string
  secondaryAction: string
}

export interface LiveActivity {
  id: string
  type: string
  title: string
  description: string
  timeLabel: string
}

export interface LiveOverviewView {
  updatedAt: string
  summary: LiveSummary
  tabCounts: { activeVisits: number; attention: number }
  activeVisits: LiveActiveVisit[]
  attentionRequired: LiveAttention[]
  recentActivity: LiveActivity[]
}

export interface ActiveVisitRow {
  reference: string
  visitId: string
  recipientName: string
  caregiverName: string | null
  service: string
  checkInTimeLabel: string | null
  status: string
}

export interface ActiveVisitsView {
  total: number
  page: number
  pageSize: number
  counts: ActiveVisitCountsDto
  rows: ActiveVisitRow[]
}

export interface MapPoint {
  visitId: string
  reference: string
  category: 'ACTIVE' | 'RUNNING_LATE'
  recipientName: string
  recipientLatitude: number | null
  recipientLongitude: number | null
  caregiverName: string | null
  status: string
  recipientAddress: string | null
  caregiverTitle: string | null
  serviceScheduled: string
  checkInTimeLabel: string | null
}

export interface MapSos {
  id: string
  caregiverName: string | null
  latitude: number | null
  longitude: number | null
}

export interface LiveMapView {
  counts: MapCountsDto
  visits: MapPoint[]
  sos: MapSos[]
}

/* -------------------------------- helpers --------------------------------- */

/** A backend priority/severity string to the app's three tone Severity union. */
export function toSeverity(value: string): Severity {
  const lower = value.toLowerCase()
  if (lower === 'critical') return 'critical'
  if (lower === 'high') return 'high'
  return 'medium'
}

/** A SCREAMING_CASE enum to "Screaming Case" for a label. */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export interface LiveFilters {
  branch: string
  serviceType: string
}

/** Drop the sentinel 'all' so the query string carries only real filters. */
function filterParams(filters: LiveFilters): string {
  const params = new URLSearchParams()
  if (filters.branch !== 'all') params.set('branch', filters.branch)
  if (filters.serviceType !== 'all') params.set('serviceType', filters.serviceType)
  const query = params.toString()
  return query ? `?${query}` : ''
}

/* -------------------------------- mappers --------------------------------- */

function toOverview(dto: OverviewDto): LiveOverviewView {
  return {
    updatedAt: dto.updatedAt,
    summary: dto.summary,
    tabCounts: dto.tabCounts,
    activeVisits: dto.activeVisits.map((visit) => ({
      visitId: visit.visitId,
      recipientName: visit.recipientName,
      caregiverName: visit.caregiverName,
      service: visit.service,
      status: visit.status,
      elapsedLabel: visit.elapsedLabel,
      progressPercent: visit.progressPercent,
    })),
    attentionRequired: dto.attentionRequired.map(toAttention),
    recentActivity: dto.recentActivity.map((entry, index) => ({
      id: `activity-${index}`,
      type: entry.type,
      title: entry.title,
      description: entry.description,
      timeLabel: entry.timeLabel,
    })),
  }
}

function toAttention(dto: AttentionDto): LiveAttention {
  return {
    id: dto.id,
    source: dto.source,
    issueType: dto.issueType,
    description: dto.description,
    severity: toSeverity(dto.priority),
    timeLabel: dto.timeLabel,
    recipientName: dto.recipientName,
    caregiverName: dto.caregiverName,
    visitId: dto.visitId,
    primaryAction: dto.primaryAction,
    secondaryAction: dto.secondaryAction,
  }
}

function toActiveVisits(dto: ActiveVisitPageDto): ActiveVisitsView {
  return {
    total: dto.total,
    page: dto.page,
    pageSize: dto.pageSize,
    counts: dto.counts,
    rows: dto.rows,
  }
}

function toMap(dto: MapDto): LiveMapView {
  return {
    counts: dto.counts,
    visits: dto.visits.map((point) => ({
      visitId: point.visitId,
      reference: point.reference,
      category: point.category,
      recipientName: point.recipientName,
      recipientLatitude: point.recipientLatitude,
      recipientLongitude: point.recipientLongitude,
      caregiverName: point.caregiverName,
      status: point.status,
      recipientAddress: point.recipientAddress,
      caregiverTitle: point.caregiverTitle,
      serviceScheduled: point.serviceScheduled,
      checkInTimeLabel: point.checkInTimeLabel,
    })),
    sos: dto.sos,
  }
}

/* --------------------------------- hooks ---------------------------------- */

/** The headline screen. Polled, since it is realtime. */
export function useLiveOverview(filters: LiveFilters) {
  return useQuery({
    queryKey: ['admin', 'monitoring', 'overview', filters],
    queryFn: async () =>
      toOverview(await api.get<OverviewDto>(`/admin/live-monitoring${filterParams(filters)}`)),
    refetchInterval: 15_000,
  })
}

export interface ActiveVisitsQuery extends LiveFilters {
  status: string
  page: number
  pageSize: number
}

export function useActiveVisits(query: ActiveVisitsQuery) {
  return useQuery({
    queryKey: ['admin', 'monitoring', 'active-visits', query],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (query.branch !== 'all') params.set('branch', query.branch)
      if (query.serviceType !== 'all') params.set('serviceType', query.serviceType)
      if (query.status !== 'all') params.set('status', query.status)
      params.set('page', String(query.page))
      params.set('pageSize', String(query.pageSize))
      return toActiveVisits(
        await api.get<ActiveVisitPageDto>(
          `/admin/live-monitoring/active-visits?${params.toString()}`,
        ),
      )
    },
  })
}

export function useAttention() {
  return useQuery({
    queryKey: ['admin', 'monitoring', 'attention'],
    queryFn: async () =>
      (await api.get<AttentionDto[]>('/admin/live-monitoring/attention')).map(toAttention),
    refetchInterval: 15_000,
  })
}

export function useLiveMap(filters: LiveFilters) {
  return useQuery({
    queryKey: ['admin', 'monitoring', 'map', filters],
    queryFn: async () =>
      toMap(await api.get<MapDto>(`/admin/live-monitoring/map${filterParams(filters)}`)),
    refetchInterval: 15_000,
  })
}

/* ------------------------------- mutations -------------------------------- */

function useInvalidateMonitoring(): () => Promise<void> {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['admin', 'monitoring'] })
    return client.invalidateQueries({ queryKey: ['admin', 'alerts'] })
  }
}

export interface AcknowledgePayload {
  id: string
  note?: string
}

export function useAcknowledgeAlert(): UseMutationResult<void, Error, AcknowledgePayload> {
  const invalidate = useInvalidateMonitoring()
  return useMutation({
    mutationFn: ({ id, note }: AcknowledgePayload) =>
      api.post<void>(`/admin/live-monitoring/alerts/${id}/acknowledge`, { note }),
    onSuccess: () => invalidate(),
  })
}

export interface ResolvePayload {
  id: string
  category?: string
  actionTaken?: string
  internalNote?: string
}

export function useResolveAlert(): UseMutationResult<void, Error, ResolvePayload> {
  const invalidate = useInvalidateMonitoring()
  return useMutation({
    mutationFn: ({ id, ...body }: ResolvePayload) =>
      api.post<void>(`/admin/live-monitoring/alerts/${id}/resolve`, body),
    onSuccess: () => invalidate(),
  })
}

export interface EscalatePayload {
  id: string
  level: string
  assignTo?: string
  reason?: string
  notes?: string
}

export function useEscalateAlert(): UseMutationResult<void, Error, EscalatePayload> {
  const invalidate = useInvalidateMonitoring()
  return useMutation({
    mutationFn: ({ id, ...body }: EscalatePayload) =>
      api.post<void>(`/admin/live-monitoring/alerts/${id}/escalate`, body),
    onSuccess: () => invalidate(),
  })
}

export function useDispatchSos(): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidateMonitoring()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<void>(`/admin/live-monitoring/sos/${id}/dispatch`),
    onSuccess: () => invalidate(),
  })
}
