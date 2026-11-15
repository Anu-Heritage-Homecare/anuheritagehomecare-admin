/**
 * Monitoring history, fetched from the backend. Three paginated read-only
 * endpoints under `/admin/live-monitoring/history`, one react-query hook each.
 * The backend pre-formats most fields (typeLabel, dateLabel, durationLabel,
 * statusLabel, categoryLabel) so the page renders them directly; only the raw
 * severity enum is mapped here, and only for a badge's tone.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Severity } from '@/types'

/* ------------------------------ query inputs ------------------------------ */

/** The window the range filter drives; mirrors the backend default of 30. */
export type HistoryDays = 7 | 30 | 90

export type CompletedStatus = 'ALL' | 'COMPLETED' | 'COMPLETED_LATE'
export type IncidentOutcomeFilter = 'ALL' | 'RESOLVED' | 'CLOSED'

interface CommonArgs {
  days: HistoryDays
  page: number
  pageSize: number
}

export interface CompletedVisitsArgs extends CommonArgs {
  status: CompletedStatus
}

export interface PastAlertsArgs extends CommonArgs {
  severity: Severity | 'ALL'
}

export interface PastIncidentsArgs extends CommonArgs {
  severity: Severity | 'ALL'
  outcome: IncidentOutcomeFilter
}

/* ---------------------------- backend responses --------------------------- */

interface PageEnvelope<Row> {
  page: number
  pageSize: number
  total: number
  totalPages: number
  generatedAt: string
  rows: Row[]
}

interface CompletedVisitRowDto {
  id: string
  reference: string
  recipientName: string
  caregiverName: string | null
  dateLabel: string
  durationLabel: string
  status: string
  statusLabel: string
}

interface PastAlertRowDto {
  id: string
  type: string
  typeLabel: string
  severity: string
  description: string
  source: string
  branch: string | null
  dateLabel: string
  createdAt: string
  resolvedAt: string | null
  resolution: string | null
  statusLabel: string
}

interface PastIncidentRowDto {
  id: string
  reference: string
  category: string
  categoryLabel: string
  severity: string
  reporter: string
  dateLabel: string
  createdAt: string
  resolvedAt: string | null
  outcome: string
}

/* --------------------------------- views ---------------------------------- */

export interface HistoryPage<Row> {
  page: number
  pageCount: number
  total: number
  rows: Row[]
}

export interface CompletedVisitRow {
  id: string
  reference: string
  recipientName: string
  caregiverName: string
  dateLabel: string
  durationLabel: string
  statusLabel: string
}

export interface PastAlertRow {
  id: string
  typeLabel: string
  severity: Severity
  description: string
  source: string
  branch: string
  dateLabel: string
  statusLabel: string
  resolution: string
}

export interface PastIncidentRow {
  id: string
  reference: string
  categoryLabel: string
  severity: Severity
  reporter: string
  dateLabel: string
  outcomeLabel: string
}

/* -------------------------------- helpers --------------------------------- */

/** A missing or empty string reads as an em-free placeholder, never fabricated. */
const show = (value: string | null | undefined): string =>
  value !== null && value !== undefined && value !== '' ? value : '—'

/** Raw severity enum to the app's three-tone union, lowercased, medium fallback. */
function toSeverity(value: string): Severity {
  const lower = value.toLowerCase()
  if (lower === 'critical') return 'critical'
  if (lower === 'high') return 'high'
  return 'medium'
}

/** RESOLVED / CLOSED to a readable word; anything else shown as-is. */
function outcomeLabel(value: string): string {
  if (value === 'RESOLVED') return 'Resolved'
  if (value === 'CLOSED') return 'Closed'
  return show(value)
}

/** The shared envelope to the view page; page is clamped by the server. */
function toPage<RowDto, Row>(
  dto: PageEnvelope<RowDto>,
  map: (row: RowDto) => Row,
): HistoryPage<Row> {
  return {
    page: dto.page,
    pageCount: Math.max(1, dto.totalPages),
    total: dto.total,
    rows: dto.rows.map(map),
  }
}

/** Only non-default filters go on the wire, matching the backend defaults. */
function toSearch(base: Record<string, string>): string {
  const params = new URLSearchParams(base)
  return params.toString()
}

/* --------------------------------- hooks ---------------------------------- */

export function useCompletedVisits(args: CompletedVisitsArgs) {
  const { days, page, pageSize, status } = args
  return useQuery({
    queryKey: ['admin', 'monitoring', 'history', 'completed-visits', { days, page, pageSize, status }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const search = toSearch({
        days: String(days),
        page: String(page),
        pageSize: String(pageSize),
        ...(status === 'ALL' ? {} : { status }),
      })
      const dto = await api.get<PageEnvelope<CompletedVisitRowDto>>(
        `/admin/live-monitoring/history/completed-visits?${search}`,
      )
      return toPage(dto, (row) => ({
        id: row.id,
        reference: show(row.reference),
        recipientName: show(row.recipientName),
        caregiverName: show(row.caregiverName),
        dateLabel: show(row.dateLabel),
        durationLabel: show(row.durationLabel),
        statusLabel: show(row.statusLabel),
      }))
    },
  })
}

export function usePastAlerts(args: PastAlertsArgs) {
  const { days, page, pageSize, severity } = args
  return useQuery({
    queryKey: ['admin', 'monitoring', 'history', 'past-alerts', { days, page, pageSize, severity }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const search = toSearch({
        days: String(days),
        page: String(page),
        pageSize: String(pageSize),
        ...(severity === 'ALL' ? {} : { priority: severity.toUpperCase() }),
      })
      const dto = await api.get<PageEnvelope<PastAlertRowDto>>(
        `/admin/live-monitoring/history/past-alerts?${search}`,
      )
      return toPage(dto, (row) => ({
        id: row.id,
        typeLabel: show(row.typeLabel),
        severity: toSeverity(row.severity),
        description: show(row.description),
        source: show(row.source),
        branch: show(row.branch),
        dateLabel: show(row.dateLabel),
        statusLabel: show(row.statusLabel),
        resolution: show(row.resolution),
      }))
    },
  })
}

export function usePastIncidents(args: PastIncidentsArgs) {
  const { days, page, pageSize, severity, outcome } = args
  return useQuery({
    queryKey: ['admin', 'monitoring', 'history', 'past-incidents', { days, page, pageSize, severity, outcome }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const search = toSearch({
        days: String(days),
        page: String(page),
        pageSize: String(pageSize),
        ...(severity === 'ALL' ? {} : { priority: severity.toUpperCase() }),
        ...(outcome === 'ALL' ? {} : { status: outcome }),
      })
      const dto = await api.get<PageEnvelope<PastIncidentRowDto>>(
        `/admin/live-monitoring/history/past-incidents?${search}`,
      )
      return toPage(dto, (row) => ({
        id: row.id,
        reference: show(row.reference),
        categoryLabel: show(row.categoryLabel),
        severity: toSeverity(row.severity),
        reporter: show(row.reporter),
        dateLabel: show(row.dateLabel),
        outcomeLabel: outcomeLabel(row.outcome),
      }))
    },
  })
}
