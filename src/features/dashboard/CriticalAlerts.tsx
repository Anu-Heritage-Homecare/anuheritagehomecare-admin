import { useNavigate } from 'react-router-dom'
import type { Alert } from './data'
import type { Severity } from '@/types'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { SeverityBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

const accent: Record<Severity, string> = {
  critical: 'bg-red-600',
  high: 'bg-red-500',
  medium: 'bg-amber-500',
}

export function CriticalAlerts({ alerts }: { alerts: Alert[] }) {
  const navigate = useNavigate()

  // The live dashboard always carries a destination path for an alert; fall
  // back to the alerts board if one is ever missing.
  const go = (target: Alert['target']) => {
    navigate(target.kind === 'path' ? target.to : '/live-monitoring/alerts')
  }

  return (
    <section aria-labelledby="critical-alerts">
      <SectionHeading
        id="critical-alerts"
        title="Critical Alerts"
        hint="System flagged abnormalities demanding immediate resolution"
        alert
      />

      <ul className="space-y-3">
        {alerts.map((a) => (
          <li key={a.id} className="card relative overflow-hidden p-4 pl-5">
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-3 left-0 w-1 rounded-r-full',
                accent[a.severity],
              )}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-ink min-w-0 font-semibold break-words">
                    {a.title}
                  </h3>
                  <SeverityBadge severity={a.severity} />
                </div>
                <p className="text-ink-muted mt-1 text-sm">{a.detail}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3 sm:justify-end">
                <span className="text-ink-subtle hidden text-xs whitespace-nowrap lg:block">
                  Coordinator: {a.coordinator}
                </span>
                <button
                  type="button"
                  onClick={() => void go(a.target)}
                  className={cn(
                    'h-11 flex-1 rounded-lg px-4 text-sm font-medium text-white transition-colors sm:h-9 sm:flex-none',
                    a.destructive
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-brand-600 hover:bg-brand-700',
                  )}
                >
                  {a.action}
                </button>
              </div>
            </div>

            {/* Coordinator moves below the fold on narrow screens */}
            <p className="text-ink-subtle mt-2 text-xs lg:hidden">
              Coordinator: {a.coordinator}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
