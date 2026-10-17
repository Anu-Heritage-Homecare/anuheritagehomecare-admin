/* ---------------------------------- types --------------------------------- */

export type GoalStatus = 'on-track' | 'needs-attention' | 'at-risk'

/*
 * Wording and bar colour for a goal's status. Held here, not in the component
 * that first needed them — the care record and the visit screen both show
 * these bars, and two copies had already drifted to "On Track" and "On track"
 * with different greens.
 */
export const goalStatusLabels: Record<GoalStatus, string> = {
  'on-track': 'On Track',
  'needs-attention': 'Needs Attention',
  'at-risk': 'At Risk',
}

export const goalBarFill: Record<GoalStatus, string> = {
  'on-track': 'bg-brand-600',
  'needs-attention': 'bg-amber-500',
  'at-risk': 'bg-red-500',
}

export interface CareGoal {
  id: string
  title: string
  /** Clinical intent, revealed when the row is expanded. */
  intent: string
  percent: number
  status: GoalStatus
  target: string
  reviewedBy: string
}

export interface ScheduleEntry {
  id: string
  time: string
  title: string
  detail: string
}

/** `critical` and `caution` items get a coloured accent and emphasis. */
export type InstructionLevel = 'standard' | 'caution' | 'critical'

export interface Instruction {
  id: string
  text: string
  level: InstructionLevel
}

export interface Revision {
  id: string
  /** ISO, for machine use. `date` is the display label. */
  dateIso: string
  date: string
  summary: string
  author: string
}

export interface CarePlan {
  goals: CareGoal[]
  schedule: ScheduleEntry[]
  medicalNeeds: Instruction[]
  behavioural: Instruction[]
  revisions: Revision[]
}

/* ---------------------------------- data ---------------------------------- */

const plans: Record<string, CarePlan> = {
  'cr-001': {
    goals: [
      {
        id: 'g1',
        title: 'Maintain daily routine independence',
        intent:
          'Preserve autonomy in dressing, grooming and meal preparation for as long as cognitively possible, with prompting rather than substitution.',
        percent: 75,
        status: 'on-track',
        target: 'Reassess quarterly',
        reviewedBy: 'Dr. Sarah Kim',
      },
      {
        id: 'g2',
        title: 'Medication adherence above 95%',
        intent:
          'Four active prescriptions across three dosing windows. Missed evening doses are the main driver of the current shortfall.',
        percent: 92,
        status: 'needs-attention',
        target: '95% by end of quarter',
        reviewedBy: 'Dr. Sarah Kim',
      },
      {
        id: 'g3',
        title: 'Physical mobility maintenance',
        intent:
          'Daily walking and guided physical therapy to slow decline in gait stability and reduce fall risk.',
        percent: 60,
        status: 'on-track',
        target: '30 min ambulation daily',
        reviewedBy: 'Emma Wilson',
      },
      {
        id: 'g4',
        title: 'Cognitive stimulation activities 3x/week',
        intent:
          'Structured memory and orientation exercises, supplemented with music therapy which has shown strong engagement.',
        percent: 85,
        status: 'on-track',
        target: '3 sessions per week',
        reviewedBy: 'Mike Chen',
      },
    ],
    schedule: [
      {
        id: 's1',
        time: '7:00 AM',
        title: 'Wake-up & Morning Hygiene',
        detail: 'Assist with bathing, grooming, dressing',
      },
      {
        id: 's2',
        time: '8:00 AM',
        title: 'Breakfast & Morning Medication',
        detail: 'Donepezil 10mg, Lisinopril 20mg, Metformin 500mg',
      },
      {
        id: 's3',
        time: '9:00 AM',
        title: 'Morning Activities',
        detail: 'Cognitive exercises, light walking',
      },
      {
        id: 's4',
        time: '12:00 PM',
        title: 'Lunch & Midday Check',
        detail: 'Nutrition monitoring, vitals check',
      },
      {
        id: 's5',
        time: '2:00 PM',
        title: 'Afternoon Activities',
        detail: 'Physical therapy exercises, social engagement',
      },
      {
        id: 's6',
        time: '5:00 PM',
        title: 'Dinner & Evening Medication',
        detail: 'Metformin 500mg',
      },
      {
        id: 's7',
        time: '8:00 PM',
        title: 'Evening Routine & Medication',
        detail: 'Memantine 10mg, wind-down activities',
      },
      {
        id: 's8',
        time: '9:00 PM',
        title: 'Bedtime',
        detail: 'Sleep positioning, night monitoring setup',
      },
    ],
    medicalNeeds: [
      { id: 'mn1', text: 'Blood pressure check twice daily', level: 'critical' },
      {
        id: 'mn2',
        text: 'Blood glucose monitoring before meals',
        level: 'standard',
      },
      {
        id: 'mn3',
        text: 'Wound dressing change every 48 hours',
        level: 'critical',
      },
      { id: 'mn4', text: 'Fall risk precautions at all times', level: 'critical' },
      {
        id: 'mn5',
        text: 'Oxygen saturation check if shortness of breath',
        level: 'standard',
      },
    ],
    behavioural: [
      {
        id: 'bn1',
        text: 'May become confused in late afternoon (sundowning)',
        level: 'caution',
      },
      { id: 'bn2', text: 'Responds well to music therapy', level: 'standard' },
      {
        id: 'bn3',
        text: 'Prefers female caregivers for personal care',
        level: 'standard',
      },
      {
        id: 'bn4',
        text: 'Allergic to penicillin — documented in chart',
        level: 'critical',
      },
      {
        id: 'bn5',
        text: 'Emergency protocol: Call 911 then notify son David',
        level: 'standard',
      },
    ],
    // Reverse-chronological, consistent format, no future dates.
    revisions: [
      {
        id: 'r1',
        dateIso: '2026-07-20',
        date: 'Jul 20, 2026',
        summary: 'Evening medication schedule adjusted',
        author: 'Mike Chen',
      },
      {
        id: 'r2',
        dateIso: '2026-07-12',
        date: 'Jul 12, 2026',
        summary: 'Quarterly review completed',
        author: 'Mike Chen',
      },
      {
        id: 'r3',
        dateIso: '2026-05-05',
        date: 'May 5, 2026',
        summary: 'Added physical therapy goal',
        author: 'Dr. Sarah Kim',
      },
      {
        id: 'r4',
        dateIso: '2026-03-15',
        date: 'Mar 15, 2026',
        summary: 'Initial care plan created',
        author: 'Dr. Sarah Kim',
      },
    ],
  },
}

/** Undefined where no plan has been authored — the tab shows an empty state. */
export function getCarePlan(recipientId: string): CarePlan | undefined {
  return plans[recipientId]
}

/**
 * Saves the Edit Care Plan page — or creates the plan, where there was none —
 * and records the change at the top of the revision history. Held in memory
 * for the session, like everything else this app writes.
 */
export function saveCarePlan(
  recipientId: string,
  plan: Omit<CarePlan, 'revisions'>,
  revision: Omit<Revision, 'id'>,
): void {
  const previous = plans[recipientId]?.revisions ?? []
  plans[recipientId] = {
    ...plan,
    revisions: [{ ...revision, id: `r-${Date.now().toString(36)}` }, ...previous],
  }
}
