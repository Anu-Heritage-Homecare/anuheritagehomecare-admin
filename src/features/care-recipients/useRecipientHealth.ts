/**
 * The care recipient Health tab, fetched from the backend and mapped into the
 * `HealthRecord` shape the Health tab components (summary, vitals trends,
 * timeline) already render. One request (`GET /admin/care-recipients/:id/health`)
 * powers the whole tab.
 *
 * The server owns the summary, latest vitals, vitals trend and the event
 * timeline; the tab keeps its existing client side filter and sort over the
 * mapped events (the first page). Fields the backend does not supply come back
 * as "—" rather than being invented here.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Tone } from '@/types'
import type {
  EventCategory,
  HealthEvent,
  HealthRecord,
  HealthSummaryCard,
  VitalStatus,
  VitalTrend,
} from './health-data'

/* --------------------------- backend response ----------------------------- */

interface LastVitalsDto {
  systolic: number | null
  diastolic: number | null
  heartRate: number | null
  oxygenSaturation: number | null
  weightGrams: number | null
  temperatureCelsius: number | null
  bloodGlucose: number | null
  recordedAt: string
}

interface VitalsSeriesDto {
  latest: number | null
  series: number[]
}

interface TimelineItemDto {
  id: string
  category: string
  title: string
  description: string
  recordedByName: string | null
  recordedByRole: string | null
  occurredAt: string
}

interface HealthDto {
  primaryConditions: { primary: string | null; others: string[] }
  lastVitals: LastVitalsDto | null
  nextAppointment: {
    providerName: string | null
    title: string
    description: string
    at: string
  } | null
  vitalsTrend: {
    bloodPressure: { latestSystolic: number | null; latestDiastolic: number | null; systolicSeries: number[] }
    heartRate: VitalsSeriesDto
    bloodGlucose: VitalsSeriesDto
    weightGrams: VitalsSeriesDto
    oxygen: VitalsSeriesDto
  }
  timeline: {
    items: TimelineItemDto[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

/* -------------------------------- helpers --------------------------------- */

const DASH = '—'

/** Backend health event category to the UI filter category and its badge/tone. */
const CATEGORIES: Record<string, { category: EventCategory; badge: string; tone: Tone }> = {
  VITALS: { category: 'vitals', badge: 'Vitals', tone: 'green' },
  INCIDENT: { category: 'incidents', badge: 'Incident', tone: 'red' },
  MEDICATION: { category: 'medication', badge: 'Medication', tone: 'blue' },
  ASSESSMENT: { category: 'assessments', badge: 'Assessment', tone: 'purple' },
  APPOINTMENT: { category: 'appointments', badge: 'Appointment', tone: 'blue' },
  SPECIALIST: { category: 'appointments', badge: 'Specialist', tone: 'blue' },
}

const DEFAULT_CATEGORY = { category: 'assessments' as EventCategory, badge: 'Event', tone: 'slate' as Tone }

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Grams to a kilogram reading, e.g. 65800 -> "65.8". */
function gramsToKg(grams: number): string {
  return (grams / 1000).toFixed(1)
}

/** Classify a systolic reading; anything out of the normal band is a watch. */
function systolicStatus(systolic: number | null): VitalStatus {
  if (systolic === null) return 'neutral'
  return systolic >= 90 && systolic <= 130 ? 'normal' : 'watch'
}

function heartRateStatus(bpm: number | null): VitalStatus {
  if (bpm === null) return 'neutral'
  return bpm >= 60 && bpm <= 100 ? 'normal' : 'watch'
}

function glucoseStatus(glucose: number | null): VitalStatus {
  if (glucose === null) return 'neutral'
  return glucose >= 70 && glucose <= 140 ? 'normal' : 'watch'
}

function oxygenStatus(saturation: number | null): VitalStatus {
  if (saturation === null) return 'neutral'
  return saturation >= 95 ? 'normal' : 'watch'
}

/* -------------------------------- mappers --------------------------------- */

function toSummary(dto: HealthDto): HealthSummaryCard[] {
  const { primaryConditions: pc, lastVitals: lv, nextAppointment: na } = dto

  const conditionsDetail =
    pc.others.length > 0 ? `Also diagnosed with ${pc.others.join(', ')}.` : 'No other conditions recorded.'

  const vitalsValue =
    lv === null || lv.systolic === null || lv.diastolic === null
      ? DASH
      : `${lv.systolic}/${lv.diastolic} mmHg${lv.heartRate === null ? '' : ` • ${lv.heartRate} bpm`}`

  const vitalsDetail =
    lv === null
      ? 'No vitals recorded yet.'
      : `${lv.temperatureCelsius === null ? '' : `Temp ${lv.temperatureCelsius.toFixed(1)}°C • `}${
          lv.oxygenSaturation === null ? '' : `O₂ ${lv.oxygenSaturation}% • `
        }Recorded ${formatDay(lv.recordedAt)}`

  const appointmentValue =
    na === null
      ? 'None scheduled'
      : `${na.providerName ?? 'Provider'} • ${formatDay(na.at)}`

  return [
    {
      id: 'conditions',
      label: 'Primary Conditions',
      value: pc.primary ?? DASH,
      detail: conditionsDetail,
    },
    {
      id: 'vitals',
      label: 'Last Vitals',
      value: vitalsValue,
      detail: vitalsDetail,
    },
    {
      id: 'appointment',
      label: 'Next Appointment',
      value: appointmentValue,
      detail: na === null ? '' : na.title,
    },
  ]
}

function toVitals(dto: HealthDto): VitalTrend[] {
  const { bloodPressure: bp, heartRate: hr, bloodGlucose: bg, weightGrams: wt, oxygen: ox } = dto.vitalsTrend

  const trends: VitalTrend[] = [
    {
      id: 'bp',
      label: 'Blood Pressure',
      value:
        bp.latestSystolic === null || bp.latestDiastolic === null
          ? DASH
          : `${bp.latestSystolic}/${bp.latestDiastolic}`,
      unit: 'mmHg',
      status: systolicStatus(bp.latestSystolic),
      series: bp.systolicSeries,
      seriesUnit: 'mmHg systolic',
    },
    {
      id: 'hr',
      label: 'Heart Rate',
      value: hr.latest === null ? DASH : String(hr.latest),
      unit: 'bpm',
      status: heartRateStatus(hr.latest),
      series: hr.series,
      seriesUnit: 'bpm',
    },
    {
      id: 'glucose',
      label: 'Blood Glucose',
      value: bg.latest === null ? DASH : String(bg.latest),
      unit: 'mg/dL',
      status: glucoseStatus(bg.latest),
      series: bg.series,
      seriesUnit: 'mg/dL',
    },
    {
      id: 'weight',
      label: 'Weight',
      value: wt.latest === null ? DASH : gramsToKg(wt.latest),
      unit: 'kg',
      status: 'neutral',
      series: wt.series.map((grams) => Math.round(grams / 1000)),
      seriesUnit: 'kg',
    },
    {
      id: 'oxygen',
      label: 'Oxygen',
      value: ox.latest === null ? DASH : String(ox.latest),
      unit: '%',
      status: oxygenStatus(ox.latest),
      series: ox.series,
      seriesUnit: '% saturation',
    },
  ]

  // Only surface a trend that carries at least one reading.
  return trends.filter((trend) => trend.series.length > 0 || trend.value !== DASH)
}

function toEvents(dto: HealthDto): HealthEvent[] {
  return dto.timeline.items.map((item) => {
    const mapping = CATEGORIES[item.category] ?? DEFAULT_CATEGORY
    return {
      id: item.id,
      date: new Date(item.occurredAt).toISOString().slice(0, 10),
      dateLabel: formatDay(item.occurredAt),
      title: item.title,
      detail: item.description,
      recordedBy: item.recordedByName ?? 'Care team',
      recordedByRole: item.recordedByRole ?? '',
      category: mapping.category,
      badge: mapping.badge,
      tone: mapping.tone,
    }
  })
}

function toRecord(dto: HealthDto): HealthRecord {
  return {
    summary: toSummary(dto),
    vitals: toVitals(dto),
    events: toEvents(dto),
  }
}

export function useRecipientHealth(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'care-recipients', id, 'health'] as const,
    enabled: id !== undefined,
    queryFn: async () => toRecord(await api.get<HealthDto>(`/admin/care-recipients/${id}/health`)),
  })
}
