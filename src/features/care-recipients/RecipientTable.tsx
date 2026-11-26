import { Link } from 'react-router-dom'
import type { Recipient } from './data'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { Avatar } from '@/components/ui/Avatar'
import {
  CareLevelTag,
  PriorityBadge,
  RecipientStatusBadge,
} from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

const columns = [
  'Care Recipient',
  'Age',
  'Primary Condition',
  'Care Level',
  'Assigned Caregivers',
  'Status',
  'Priority',
  'Last Visit',
]

/** Actions available from a directory row. */
function rowMenu(recipient: Recipient) {
  return [
    { id: 'view', label: 'View profile', to: `/care-recipients/${recipient.id}` },
    {
      id: 'plan',
      label: 'Open care plan',
      to: `/care-recipients/${recipient.id}/care-plan`,
    },
    {
      id: 'billing',
      label: 'Open billing',
      to: `/care-recipients/${recipient.id}/billing`,
    },
    {
      id: 'discharge',
      label: 'Archive or discharge…',
      to: `/care-recipients/${recipient.id}/discharge`,
      destructive: true,
    },
  ]
}

function NameCell({ recipient }: { recipient: Recipient }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={recipient.name} decorative className="size-9" />
      <div className="min-w-0">
        <Link
          to={`/care-recipients/${recipient.id}`}
          className="text-ink hover:text-brand-700 block truncate text-sm font-semibold"
        >
          {recipient.name}
        </Link>
        <p className="text-ink-subtle text-xs">{recipient.ref}</p>
      </div>
    </div>
  )
}

interface RecipientTableProps {
  rows: Recipient[]
  /** Changes the empty-state copy so it names the real cause. */
  searching?: boolean
}

export function RecipientTable({ rows, searching }: RecipientTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-ink-subtle px-4 py-16 text-center text-sm">
        {searching
          ? 'No care recipients match your search.'
          : 'No care recipients match this filter.'}
      </p>
    )
  }

  return (
    <>
      {/* Desktop: nine columns, scrolled horizontally rather than clipped.
          Focusable so the scroll region is reachable by keyboard. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Care recipients table"
        className="hidden overflow-x-auto lg:block"
      >
        <table className="w-full min-w-5xl text-left text-sm">
          <thead className="border-line bg-sunken text-ink-muted border-b text-xs">
            <tr>
              {columns.map((col) => (
                <th key={col} scope="col" className="px-4 py-3 font-semibold tracking-wide uppercase">
                  {col}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-semibold tracking-wide uppercase">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-line divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-canvas transition-colors">
                {/* Row header, so the other eight cells are announced with
                    the person they belong to. */}
                <th scope="row" className="px-4 py-3 font-normal">
                  <NameCell recipient={r} />
                </th>
                <td className="text-ink-muted px-4 py-3">{r.age}</td>
                <td className="text-ink-muted px-4 py-3">{r.condition}</td>
                <td className="px-4 py-3">
                  <CareLevelTag level={r.careLevel} />
                </td>
                <td
                  className={cn(
                    'px-4 py-3',
                    r.caregiver ? 'text-ink-muted' : 'text-ink-subtle',
                  )}
                >
                  {r.caregiver ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <RecipientStatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={r.priority} />
                </td>
                <td
                  className={cn(
                    'px-4 py-3 whitespace-nowrap',
                    r.lastVisit ? 'text-ink-muted' : 'text-ink-subtle',
                  )}
                >
                  {r.lastVisit ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end">
                    <DropdownMenu
                      label={`Actions for ${r.name}`}
                      items={rowMenu(r)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile and tablet: a nine-column table has no honest small-screen form */}
      <ul className="divide-line divide-y lg:hidden">
        {rows.map((r) => (
          <li key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <NameCell recipient={r} />
              <DropdownMenu
                label={`Actions for ${r.name}`}
                items={rowMenu(r)}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <RecipientStatusBadge status={r.status} />
              <PriorityBadge priority={r.priority} />
              <CareLevelTag level={r.careLevel} />
            </div>

            <dl className="text-ink-muted mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm min-[420px]:grid-cols-2">
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle shrink-0">Condition:</dt>
                <dd className="min-w-0 break-words">{r.condition}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle shrink-0">Age:</dt>
                <dd>{r.age}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle shrink-0">Caregivers:</dt>
                <dd className="min-w-0 break-words">
                  {r.caregiver ?? 'Unassigned'}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-subtle shrink-0">Last visit:</dt>
                <dd>{r.lastVisit ?? 'None yet'}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
