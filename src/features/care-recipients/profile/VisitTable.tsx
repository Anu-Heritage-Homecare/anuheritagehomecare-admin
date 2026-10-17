import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { VisitRecord } from '../visits-data'
import { formatDuration, formatVisitDate } from '../visits-data'
import { staffMembers } from '@/features/caregivers/staff'
import { VisitStatusBadge } from '@/components/ui/StatusBadge'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { MenuItem } from '@/components/ui/DropdownMenu'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'

/*
 * Row actions for a past visit. History records are their own fixture, not the
 * scheduling board's visits, so "View details" opens the record here (with the
 * notes the desktop table has no column for) rather than linking to a board
 * visit that may not be the same one.
 */
function caregiverPath(name: string): string | undefined {
  const member = staffMembers.find((m) => m.name === name)
  return member ? `/caregivers/${member.id}` : undefined
}

function itemsFor(v: VisitRecord, recipientId: string, onView: () => void): MenuItem[] {
  const caregiver = caregiverPath(v.caregiver)
  return [
    { id: 'view', label: 'View visit details', onSelect: onView },
    ...(caregiver ? [{ id: 'caregiver', label: `View ${v.caregiver}`, to: caregiver }] : []),
    { id: 'note', label: 'Add care note', to: `/care-recipients/${recipientId}/notes` },
    { id: 'follow-up', label: 'Schedule follow-up visit', to: `/scheduling/visits/new?recipient=${recipientId}` },
  ]
}

function VisitDetails({ visit, recipientId }: { visit: VisitRecord; recipientId: string }) {
  const caregiver = caregiverPath(visit.caregiver)
  const rows: [string, React.ReactNode][] = [
    ['Date and time', formatVisitDate(visit)],
    ['Caregiver', caregiver ? <Link to={caregiver} className="text-brand-700 hover:underline">{visit.caregiver}</Link> : visit.caregiver],
    ['Visit type', visit.type],
    ['Duration', formatDuration(visit.durationHours)],
    ['Clock in', visit.clockIn ?? '—'],
    ['Clock out', visit.clockOut ?? '—'],
    ['Status', <VisitStatusBadge key="s" status={visit.status} />],
  ]
  return (
    <div className="space-y-5 p-5">
      <dl className="divide-line divide-y text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="text-ink text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="text-ink text-sm font-semibold">Caregiver notes</h3>
        <p className="text-ink-muted mt-1.5 text-sm break-words">{visit.notes || 'No notes were recorded.'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/care-recipients/${recipientId}/notes`}
          className="border-control text-ink hover:bg-sunken inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium"
        >
          Add care note
        </Link>
        <Link
          to={`/scheduling/visits/new?recipient=${recipientId}`}
          className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-white"
        >
          Schedule follow-up visit
        </Link>
      </div>
    </div>
  )
}

const columns = [
  'Date and Time',
  'Caregiver',
  'Visit Type',
  'Duration',
  'Clock In',
  'Clock Out',
  'Status',
]

export function VisitTable({ rows, recipientId }: { rows: VisitRecord[]; recipientId: string }) {
  const [viewing, setViewing] = useState<VisitRecord | null>(null)

  if (rows.length === 0) {
    return (
      <p className="text-ink-subtle px-4 py-16 text-center text-sm">
        No visits match these filters.
      </p>
    )
  }

  return (
    <>
      {/* Eight columns need 896px; only at xl (960px content box) does that fit
          without scrolling Status — a filter dimension — off the right edge. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Visit history table"
        className="hidden overflow-x-auto xl:block"
      >
        <table className="w-full min-w-4xl text-left text-sm">
          <thead className="border-line bg-sunken text-ink-muted border-y text-xs">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-3 py-2.5 font-semibold tracking-wide uppercase xl:px-4"
                >
                  {col}
                </th>
              ))}
              <th
                scope="col"
                className="px-3 py-2.5 text-right font-semibold tracking-wide uppercase xl:px-4"
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-line divide-y">
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-canvas transition-colors">
                <th
                  scope="row"
                  className="text-ink px-3 py-3 font-medium whitespace-nowrap xl:px-4"
                >
                  {formatVisitDate(v)}
                </th>
                <td className="text-ink-muted px-3 py-3 xl:px-4">
                  {v.caregiver}
                </td>
                <td className="text-ink-muted px-3 py-3 xl:px-4">{v.type}</td>
                <td className="text-ink-muted px-3 py-3 whitespace-nowrap xl:px-4">
                  {formatDuration(v.durationHours)}
                </td>
                <td
                  className={cn(
                    'px-3 py-3 whitespace-nowrap xl:px-4',
                    v.clockIn ? 'text-ink-muted' : 'text-ink-subtle',
                  )}
                >
                  {v.clockIn ?? '—'}
                </td>
                <td
                  className={cn(
                    'px-3 py-3 whitespace-nowrap xl:px-4',
                    v.clockOut ? 'text-ink-muted' : 'text-ink-subtle',
                  )}
                >
                  {v.clockOut ?? '—'}
                </td>
                <td className="px-3 py-3 xl:px-4">
                  <VisitStatusBadge status={v.status} />
                </td>
                <td className="px-3 py-3 text-right xl:px-4">
                  <span className="inline-flex">
                    <DropdownMenu
                      label={`Actions for visit on ${formatVisitDate(v)}`}
                      items={itemsFor(v, recipientId, () => setViewing(v))}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile and tablet: clock times pair up as a single range line */}
      <ul className="divide-line border-line divide-y border-t xl:hidden">
        {rows.map((v) => (
          <li key={v.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink text-sm font-semibold break-words">
                  {formatVisitDate(v)}
                </p>
                <p className="text-ink-muted mt-0.5 text-sm">
                  {v.type} · {formatDuration(v.durationHours)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <VisitStatusBadge status={v.status} />
                <DropdownMenu
                  label={`Actions for visit on ${formatVisitDate(v)}`}
                  items={itemsFor(v, recipientId, () => setViewing(v))}
                />
              </div>
            </div>

            <dl className="text-ink-muted mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm min-[420px]:grid-cols-2">
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle shrink-0">Caregiver:</dt>
                <dd className="min-w-0 break-words">{v.caregiver}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle shrink-0">Clocked:</dt>
                <dd className={cn(!v.clockIn && 'text-ink-subtle')}>
                  {v.clockIn ? `${v.clockIn} – ${v.clockOut}` : 'No clock-in'}
                </dd>
              </div>
            </dl>

            <p className="text-ink-subtle mt-2 text-sm break-words">{v.notes}</p>
          </li>
        ))}
      </ul>

      <Drawer
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Visit Details"
        subtitle={viewing ? `${viewing.type}, ${formatVisitDate(viewing)}` : undefined}
      >
        {viewing && <VisitDetails visit={viewing} recipientId={recipientId} />}
      </Drawer>
    </>
  )
}
