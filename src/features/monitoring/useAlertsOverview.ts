/**
 * The Alerts and Incidents screen, fetched from the backend. One request powers
 * the KPIs, the tab counts and the alert feed (`GET /admin/alerts/overview`), a
 * second powers the Incidents tab (`GET /admin/alerts/incidents`). The mutations
 * (acknowledge, resolve, dismiss) act on a single alert and invalidate the whole
 * `['admin','alerts']` tree so the counts and the feed refresh together.
 *
 * Attribution is server side from the admin token; no actor name is sent. Enum
 * strings (priority, status, kind) are lowercased and fall back, never faked.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Priority, Severity } from '@/types'

/* --------------------------- backend responses ---------------------------- */

interface AlertsKpisDto {
  activeAlerts: number
  highPriority: number
  critical: number
  openIncidents: number
  resolvedToday: number
}

interface AlertsCountsDto {
  all: number
  activeAlerts: number
  incidents: number
  emergencies: number
  resolved: number
}

interface AlertRowDto {
  id: string
  kind: string
  type: string
  description: string
  source: string
  timeLabel: string
  at: string
  priority: string
  status: string
}

interface AlertsOverviewDto {
  generatedAt: string
  kpis: AlertsKpisDto
  counts: AlertsCountsDto
  items: AlertRowDto[]
}

interface IncidentRowDto {
  id: string
  incidentId: string
  description: string
  detail: string | null
  reporter: string
  timeLabel: string
  at: string
  priority: string
  status: string
}

interface IncidentsListDto {
  generatedAt: string
  items: IncidentRowDto[]
}

/* ------------------------------- view model ------------------------------- */

/** The UI tab, driven from the URL and mapped to the backend tab enum. */
export type AlertTab = 'all' | 'active' | 'emergencies' | 'resolved' | 'incidents'

/** The alert feed row, mapped to the app's badge vocabulary. */
export interface AlertRow {
  id: string
  kind: string
  type: string
  description: string
  source: string
  timeLabel: string
  priority: Priority
  severity: Severity
  statusLabel: string
}

/** An incident register row. */
export interface IncidentRow {
  id: string
  reference: string
  description: string
  detail: string
  reporter: string
  timeLabel: string
  priority: Priority
  statusLabel: string
}

export interface AlertsOverviewView {
  kpis: AlertsKpisDto
  counts: AlertsCountsDto
  items: AlertRow[]
}

/* -------------------------------- helpers --------------------------------- */

const PRIORITIES: Priority[] = ['critical', 'urgent', 'high', 'medium', 'normal', 'low']
function toPriority(value: string): Priority {
  const lower = value.toLowerCase()
  return PRIORITIES.find((p) => p === lower) ?? 'normal'
}

function toSeverity(value: string): Severity {
  const lower = value.toLowerCase()
  if (lower === 'critical') return 'critical'
  if (lower === 'high') return 'high'
  return 'medium'
}

/** An enum-ish string like IN_PROGRESS to "In Progress". */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const UI_TO_BACKEND_TAB: Record<AlertTab, 'ALL' | 'ACTIVE_ALERTS' | 'EMERGENCIES' | 'RESOLVED'> = {
  all: 'ALL',
  active: 'ACTIVE_ALERTS',
  emergencies: 'EMERGENCIES',
  resolved: 'RESOLVED',
  // The Incidents tab has its own endpoint; the overview tab enum has no slot
  // for it, so it reads the full list.
  incidents: 'ALL',
}

/* -------------------------------- mappers --------------------------------- */

function toOverviewView(dto: AlertsOverviewDto): AlertsOverviewView {
  return {
    kpis: dto.kpis,
    counts: dto.counts,
    items: dto.items.map((row) => ({
      id: row.id,
      kind: row.kind,
      type: titleCase(row.type),
      description: row.description || '—',
      source: row.source || '—',
      timeLabel: row.timeLabel || '—',
      priority: toPriority(row.priority),
      severity: toSeverity(row.priority),
      statusLabel: titleCase(row.status),
    })),
  }
}

function toIncidentRows(dto: IncidentsListDto): IncidentRow[] {
  return dto.items.map((row) => ({
    id: row.id,
    reference: row.incidentId,
    description: row.description || '—',
    detail: row.detail ?? '',
    reporter: row.reporter || '—',
    timeLabel: row.timeLabel || '—',
    priority: toPriority(row.priority),
    statusLabel: titleCase(row.status),
  }))
}

/* --------------------------------- query ---------------------------------- */

export interface AlertsQuery {
  tab: AlertTab
  branch: string
  serviceType: string
}

/** The overview feed, filtered server side by tab, branch and service type. */
export function useAlertsOverview(query: AlertsQuery) {
  return useQuery({
    queryKey: ['admin', 'alerts', 'overview', query],
    queryFn: async () => {
      const params = new URLSearchParams({ tab: UI_TO_BACKEND_TAB[query.tab] })
      if (query.branch !== 'all') params.set('branch', query.branch)
      if (query.serviceType !== 'all') params.set('serviceType', query.serviceType)
      return toOverviewView(
        await api.get<AlertsOverviewDto>(`/admin/alerts/overview?${params.toString()}`),
      )
    },
  })
}

/** The Incidents tab list, loaded only while that tab is open. */
export function useAlertIncidents(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'alerts', 'incidents'],
    queryFn: async () => toIncidentRows(await api.get<IncidentsListDto>('/admin/alerts/incidents')),
    enabled,
  })
}

/* ------------------------------- mutations -------------------------------- */

type AlertAction = 'acknowledge' | 'resolve' | 'dismiss'

/** Acknowledge, resolve or dismiss an alert; each refreshes the whole screen. */
export function useAlertActions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: AlertAction }) =>
      api.post(`/admin/alerts/${id}/${action}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'alerts'] })
    },
  })
}
