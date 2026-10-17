/**
 * The Operations Report's content, taken verbatim from the Figma
 * (operations-report) at the user's request — these are the design's figures,
 * not figures computed from the app's rota. The filters on the page therefore
 * do not change them.
 *
 * The daily series is read off the design's chart: its shape is the Figma's
 * and it sums to the stated 412 visits.
 */

export const reportingPeriod = 'Oct 1 - Oct 30, 2024'

export const filterOptions = {
  branch: ['All Branches', 'Portland Central', 'Portland East', 'Beaverton', 'Lake Oswego', 'Tigard', 'Hillsboro'],
  service: [
    'All Services',
    'Personal Care',
    'Medication Management',
    'Companionship',
    'Meal Preparation',
    'Transportation',
    'Housekeeping',
  ],
  caregiver: ['All Caregivers'],
  status: ['All Statuses', 'Completed', 'Cancelled'],
} as const

export type TileTone = 'blue' | 'green' | 'red' | 'amber'

export const tiles: { label: string; value: string; badge: string; tone: TileTone }[] = [
  { label: 'Total Visits', value: '412', badge: '+8% vs last month', tone: 'blue' },
  { label: 'Completed', value: '396 (96.2%)', badge: '98% target', tone: 'green' },
  { label: 'Cancelled', value: '16 (3.8%)', badge: '3.8% rate', tone: 'red' },
  { label: 'Avg Duration', value: '2.4 hrs', badge: 'On target', tone: 'amber' },
]

/** Oct 1 → Oct 30. */
export const visitsByDay = [
  10, 13, 9, 14, 17, 11, 15, 18, 10, 13, 14, 19, 11, 9, 15, 17, 14, 18, 11, 10, 13, 15, 17, 11, 14, 19, 13, 10, 15, 17,
]

/** Day-of-month index → axis label, as the design places them. */
export const dayTicks: { index: number; label: string }[] = [
  { index: 0, label: 'Oct 1' },
  { index: 9, label: 'Oct 10' },
  { index: 19, label: 'Oct 20' },
  { index: 29, label: 'Oct 30' },
]

export const COMPLETION_TARGET = 95

export const completionByWeek = [
  { label: 'W1', value: 95 },
  { label: 'W2', value: 97 },
  { label: 'W3', value: 96 },
  { label: 'W4', value: 97 },
]

export const cancellations = {
  total: 16,
  reasons: [
    { label: 'Client Request', share: 38, colour: '#4a7dea' },
    { label: 'Caregiver Unavail.', share: 25, colour: '#e8a23a' },
    { label: 'Weather', share: 19, colour: '#9ca3af' },
    { label: 'Emergency', share: 12, colour: '#e0524d' },
    { label: 'Other', share: 6, colour: '#4a64f0' },
  ],
}

export const serviceTypes = [
  { label: 'Personal Care', visits: 142 },
  { label: 'Medication Management', visits: 98 },
  { label: 'Companionship', visits: 72 },
  { label: 'Meal Preparation', visits: 54 },
  { label: 'Transportation', visits: 28 },
  { label: 'Housekeeping', visits: 18 },
]

/** The design draws the longest bar at half the track. */
export const SERVICE_BAR_SCALE = 286

export type Trend = 'up' | 'flat' | 'down'

export const locations: {
  name: string
  visits: number
  completion: string
  duration: string
  satisfaction: string
  trend: Trend
}[] = [
  { name: 'Portland Central', visits: 128, completion: '97.5%', duration: '2.3 hrs', satisfaction: '4.9/5', trend: 'up' },
  { name: 'Portland East', visits: 96, completion: '96.1%', duration: '2.5 hrs', satisfaction: '4.8/5', trend: 'up' },
  { name: 'Beaverton', visits: 74, completion: '95.8%', duration: '2.4 hrs', satisfaction: '4.7/5', trend: 'flat' },
  { name: 'Lake Oswego', visits: 62, completion: '96.4%', duration: '2.6 hrs', satisfaction: '4.8/5', trend: 'up' },
  { name: 'Tigard', visits: 32, completion: '94.2%', duration: '2.2 hrs', satisfaction: '4.6/5', trend: 'down' },
  { name: 'Hillsboro', visits: 20, completion: '95.0%', duration: '2.1 hrs', satisfaction: '4.5/5', trend: 'flat' },
]
