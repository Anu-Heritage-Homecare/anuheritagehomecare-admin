import { Download, Loader2 } from 'lucide-react'
import { OperationsSnapshot } from '@/features/dashboard/OperationsSnapshot'
import { TodaysSchedule } from '@/features/dashboard/TodaysSchedule'
import { CriticalAlerts } from '@/features/dashboard/CriticalAlerts'
import { ActivityTimeline } from '@/features/dashboard/ActivityTimeline'
import { QuickActions } from '@/features/dashboard/QuickActions'
import { PerformanceSnapshot } from '@/features/dashboard/PerformanceSnapshot'
import { useDashboard } from '@/features/dashboard/useDashboard'

export function DashboardPage() {
  const { data, isPending, isError, error, refetch } = useDashboard()

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-bold tracking-tight sm:text-[1.75rem]">
            Welcome to Careprofs Dashboard
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Monitor today's care operations, identify critical issues, and keep
            every visit running smoothly.
          </p>
        </div>

        <button
          type="button"
          className="border-control text-ink hover:bg-sunken inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
        >
          <Download className="size-4" strokeWidth={1.9} />
          Download Report
        </button>
      </header>

      {isPending ? (
        <div className="text-ink-subtle flex items-center justify-center gap-2 py-24 text-sm">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Loading dashboard…
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-ink text-sm font-medium">Could not load the dashboard.</p>
          <p className="text-ink-subtle text-sm">{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <OperationsSnapshot stats={data.stats} />
          <TodaysSchedule visits={data.visits} />
          <CriticalAlerts alerts={data.alerts} />

          {/* Timeline gets the wider column; actions collapse beneath it under 1280px */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ActivityTimeline activity={data.activity} />
            </div>
            <QuickActions />
          </div>

          <PerformanceSnapshot metrics={data.metrics} />
        </>
      )}
    </div>
  )
}
