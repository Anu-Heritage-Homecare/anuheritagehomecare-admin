import { Star, Loader2 } from 'lucide-react'
import type { StaffMember } from './staff'
import {
  useCaregiverPerformance,
  type PerformanceReviewDto,
} from './useCaregiverPerformance'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/lib/cn'

/** Five outlines, filled to the nearest half. A number alone reads as a count. */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'size-3.5',
            rating >= n - 0.25
              ? 'fill-amber-400 text-amber-400'
              : rating >= n - 0.75
                ? 'fill-amber-200 text-amber-400'
                : 'text-ink-subtle',
          )}
          strokeWidth={1.8}
        />
      ))}
    </span>
  )
}

const reviewDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
function formatReviewDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : reviewDate.format(date)
}

export function PerformanceTab({ member }: { member: StaffMember }) {
  const { data, isPending, isError, error, refetch } = useCaregiverPerformance(member.id)

  if (isPending) {
    return (
      <p className="text-ink-subtle flex items-center justify-center gap-2 py-16 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading performance…
      </p>
    )
  }
  if (isError) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-ink text-sm font-medium">Could not load performance.</p>
        <p className="text-ink-subtle text-sm">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="bg-brand-600 hover:bg-brand-700 h-10 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  const { scoreCards, keyMetrics, clientFeedback, trend, history, recentReviews } = data

  const clientReviews = recentReviews.filter((r) => r.reviewerType !== 'INTERNAL')
  const internalReviews = recentReviews.filter((r) => r.reviewerType === 'INTERNAL')

  const tiles = [
    {
      id: 'overall',
      label: 'Overall score',
      value: scoreCards.overallScore === null ? 'Not scored' : `${scoreCards.overallScore} / 5`,
      hint: data.periodLabel,
    },
    {
      id: 'punctuality',
      label: 'Punctuality',
      value:
        scoreCards.punctualityPercent === null ? 'No data' : `${scoreCards.punctualityPercent}%`,
      hint:
        keyMetrics.onTimeArrivals.total === 0
          ? 'No visits logged'
          : `${keyMetrics.onTimeArrivals.onTime} on time of ${keyMetrics.onTimeArrivals.total} attended`,
    },
    {
      id: 'satisfaction',
      label: 'Client rating',
      value:
        clientFeedback.averageRating === null ? 'No reviews' : `${clientFeedback.averageRating} / 5`,
      hint:
        clientFeedback.totalReviews === 0
          ? 'Nobody has reviewed this caregiver'
          : `Mean of ${clientFeedback.totalReviews} review${clientFeedback.totalReviews === 1 ? '' : 's'}`,
    },
    {
      id: 'completion',
      label: 'Task completion',
      value:
        scoreCards.taskCompletionPercent === null
          ? 'No data'
          : `${scoreCards.taskCompletionPercent}%`,
      hint: `${keyMetrics.missedVisits} missed of ${keyMetrics.visitsCompleted + keyMetrics.missedVisits} scheduled`,
    },
  ]

  return (
    <div className="space-y-4">
      <section aria-labelledby="performance-tiles">
        <h2 id="performance-tiles" className="sr-only">
          Headline scores
        </h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <article key={t.id} className="card p-4">
              <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
                {t.label}
              </p>
              <p className="text-ink mt-2 text-2xl font-bold tracking-tight tabular-nums">
                {t.value}
              </p>
              <p className="text-ink-subtle mt-1 text-xs break-words">{t.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Key metrics">
          <p className="text-ink-muted -mt-1 mb-3 text-sm">{data.periodLabel}.</p>
          <Rows
            rows={[
              ['Visits completed', String(keyMetrics.visitsCompleted)],
              ['Hours logged', `${keyMetrics.hoursLogged}h`],
              [
                'On time arrivals',
                keyMetrics.onTimeArrivals.percent === null
                  ? '—'
                  : `${keyMetrics.onTimeArrivals.percent}%`,
              ],
              ['Late arrivals', String(keyMetrics.lateArrivals.count)],
              ['Early departures', String(keyMetrics.earlyDepartures)],
              ['Missed visits', String(keyMetrics.missedVisits)],
              ['Overtime hours', `${keyMetrics.overtimeHours}h`],
            ]}
          />
        </Panel>

        <Panel title="Client feedback">
          {clientFeedback.totalReviews === 0 ? (
            <p className="text-ink-subtle text-sm">No reviews have been left for {member.name}.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-ink text-2xl font-bold tracking-tight tabular-nums">
                  {clientFeedback.averageRating} <span className="sr-only">out of 5</span>
                </p>
                <Stars rating={clientFeedback.averageRating ?? 0} />
                <p className="text-ink-muted text-sm">
                  from {clientFeedback.totalReviews} review
                  {clientFeedback.totalReviews === 1 ? '' : 's'}
                </p>
              </div>
              <Rows
                className="mt-3"
                rows={[
                  ['Positive, 4 stars and up', String(clientFeedback.positiveReviews)],
                  ['Neutral, 3 stars', String(clientFeedback.neutralReviews)],
                  ['Negative, 2 stars and under', String(clientFeedback.negativeReviews)],
                  [
                    'Most praised',
                    clientFeedback.mostPraisedTraits.length === 0
                      ? 'Nothing repeated yet'
                      : clientFeedback.mostPraisedTraits.join(', '),
                  ],
                  [
                    'Areas for growth',
                    clientFeedback.areasForGrowth.length === 0
                      ? 'None recorded'
                      : clientFeedback.areasForGrowth.join(', '),
                  ],
                ]}
              />
            </>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Rating by month">
          {trend.length === 0 ? (
            <p className="text-ink-subtle text-sm">No month in the last six carries a score.</p>
          ) : (
            <>
              {/* Bars are decorative; the same figures follow as a table so the
                  trend is not sighted only. */}
              <ul aria-hidden="true" className="flex items-end gap-3">
                {trend.map((row) => (
                  <li key={row.monthLabel} className="min-w-0 flex-1 text-center">
                    <p className="text-ink text-sm font-semibold tabular-nums">
                      {row.score ?? '—'}
                    </p>
                    <div
                      className="bg-brand-500 mx-auto mt-1 w-full rounded-t"
                      style={{ height: `${((row.score ?? 0) / 5) * 120}px` }}
                    />
                    <p className="text-ink-subtle mt-1 truncate text-xs">{row.monthLabel}</p>
                  </li>
                ))}
              </ul>
              <table className="sr-only">
                <caption>Average score by month</caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((row) => (
                    <tr key={row.monthLabel}>
                      <th scope="row">{row.monthLabel}</th>
                      <td>{row.score ?? 'not scored'} out of 5</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Panel>

        <Panel title="Six-month history" flush>
          <div
            tabIndex={0}
            role="region"
            aria-label="Performance by month"
            className="hidden overflow-x-auto sm:block"
          >
            <table className="w-full min-w-2xl text-left text-sm">
              <thead className="border-line bg-sunken text-ink-muted border-y text-xs">
                <tr>
                  {['Month', 'Score', 'Visits', 'Hours', 'Punctuality', 'CSAT'].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-4 py-2.5 font-semibold tracking-wide uppercase"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {history.map((row) => (
                  <tr key={row.monthLabel} className="hover:bg-canvas transition-colors">
                    <th scope="row" className="text-ink px-4 py-3 font-medium whitespace-nowrap">
                      {row.monthLabel}
                    </th>
                    <td className="text-ink-muted px-4 py-3 tabular-nums">{row.score ?? '—'}</td>
                    <td className="text-ink-muted px-4 py-3 tabular-nums">{row.visits}</td>
                    <td className="text-ink-muted px-4 py-3 tabular-nums">{row.hours}h</td>
                    <td className="text-ink-muted px-4 py-3 tabular-nums">
                      {row.punctualityPercent === null ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        `${row.punctualityPercent}%`
                      )}
                    </td>
                    <td className="text-ink-muted px-4 py-3 tabular-nums">
                      {row.csat === null ? <span className="text-ink-subtle">—</span> : row.csat}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Card fallback: six columns cannot be read at 320. */}
          <ul className="divide-line border-line divide-y border-t sm:hidden">
            {history.map((row) => (
              <li key={row.monthLabel} className="p-4">
                <p className="text-ink text-sm font-semibold">{row.monthLabel}</p>
                <p className="text-ink-muted mt-1 text-sm break-words">
                  {row.visits} visits, {row.hours}h
                </p>
                <p className="text-ink-subtle mt-0.5 text-xs">
                  Punctuality {row.punctualityPercent === null ? '—' : `${row.punctualityPercent}%`}{' '}
                  · score {row.score ?? '—'}
                </p>
              </li>
            ))}
          </ul>

          <p className="text-ink-subtle border-line border-t px-4 py-3 text-xs">
            A dash means nothing was recorded that month.
          </p>
        </Panel>
      </div>

      <Panel
        title="Client reviews"
        badge={
          <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-xs">
            {clientReviews.length}
          </span>
        }
      >
        {clientReviews.length === 0 ? (
          <p className="text-ink-subtle text-sm">Nothing from families yet.</p>
        ) : (
          <ul className="divide-line divide-y">
            {clientReviews.map((review, i) => (
              <ReviewRow key={`client-${i}`} review={review} />
            ))}
          </ul>
        )}
      </Panel>

      {internalReviews.length > 0 && (
        <Panel title="Internal reviews">
          <ul className="divide-line divide-y">
            {internalReviews.map((review, i) => (
              <ReviewRow key={`internal-${i}`} review={review} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}

/* ---------------------------------- parts --------------------------------- */

function Rows({ rows, className }: { rows: [string, string][]; className?: string }) {
  return (
    <dl className={cn('divide-line divide-y', className)}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-ink-muted min-w-0 text-sm">{label}</dt>
          <dd className="text-ink min-w-0 text-right text-sm font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReviewRow({ review }: { review: PerformanceReviewDto }) {
  const author = review.authorName ?? 'Anonymous'
  const role = review.relationship ?? (review.reviewerType === 'INTERNAL' ? 'Internal' : 'Family')
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-ink min-w-0 text-sm font-semibold break-words">
          {author}
          <span className="text-ink-subtle ml-2 text-xs font-normal">{role}</span>
        </p>
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Stars rating={review.rating} />
          <span className="text-ink-subtle text-xs">
            {review.rating} out of 5 · {formatReviewDate(review.createdAt)}
          </span>
        </span>
      </div>
      {review.comment && <p className="text-ink-muted mt-1.5 text-sm break-words">{review.comment}</p>}
      {review.recipientName && (
        <p className="text-ink-subtle mt-1 text-xs">For {review.recipientName}</p>
      )}
    </li>
  )
}
