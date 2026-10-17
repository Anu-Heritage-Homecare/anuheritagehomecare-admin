import { Link } from 'react-router-dom'
import type { RecipientProfile } from '../profile-data'
import type { TabAction } from './tabs'
import { Avatar } from '@/components/ui/Avatar'
import {
  PriorityBadge,
  RecipientStatusBadge,
} from '@/components/ui/StatusBadge'
import { cn } from '@/lib/cn'

interface ProfileHeaderProps {
  profile: RecipientProfile
  actions: TabAction[]
}

export function ProfileHeader({ profile, actions }: ProfileHeaderProps) {
  const meta = [
    profile.ref,
    `Age ${profile.age}`,
    profile.sex,
    profile.condition,
    `${profile.careLevel} Care`,
  ]

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <Avatar
          name={profile.name}
          decorative
          className="size-14 text-lg sm:size-16 sm:text-xl"
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-ink text-xl font-bold tracking-tight break-words sm:text-2xl">
              {profile.name}
            </h1>
            <RecipientStatusBadge status={profile.status} />
            <PriorityBadge priority={profile.priority} />
          </div>

          {/* Separators are decorative; the list reads as plain items to AT */}
          <ul className="text-ink-muted mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {meta.map((item, i) => (
              // Index key: synthesised profiles can repeat a value
              // (condition === sex === 'Not recorded').
              <li key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden="true" className="text-ink-subtle">
                    •
                  </span>
                )}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 min-[420px]:flex-row print:hidden">
        {actions.map(({ label, icon: Icon, primary, to, print }) => {
          const className = cn(
            'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors',
            primary
              ? 'bg-brand-600 hover:bg-brand-700 text-white'
              : 'border-control text-ink hover:bg-sunken border',
          )
          const body = (
            <>
              <Icon className="size-4" strokeWidth={1.9} />
              {label}
            </>
          )
          return to ? (
            <Link key={label} to={to(profile.id)} className={className}>
              {body}
            </Link>
          ) : (
            <button
              key={label}
              type="button"
              onClick={print ? () => window.print() : undefined}
              className={className}
            >
              {body}
            </button>
          )
        })}
      </div>
    </div>
  )
}
