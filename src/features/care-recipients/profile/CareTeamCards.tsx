import { MessageSquare, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { staffByName } from '@/features/caregivers/staff'
import type { CaregiverRole, CaregiverStatus, TeamMember } from '../caregivers-data'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

const roleColour: Record<CaregiverRole, string> = {
  'Primary Caregiver': 'text-brand-700',
  'Backup Caregiver': 'text-blue-700',
  'Clinical Nurse': 'text-emerald-700',
  'Relief Caregiver': 'text-violet-700',
  'Care Coordinator': 'text-ink-muted',
}

const statusChip: Record<CaregiverStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  available: 'bg-blue-50 text-blue-700',
  'off-duty': 'bg-slate-100 text-slate-600',
}

const statusLabel: Record<CaregiverStatus, string> = {
  active: 'Active',
  available: 'Available',
  'off-duty': 'Off duty',
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
        {label}
      </dt>
      <dd className="text-ink mt-0.5 text-sm break-words">{value}</dd>
    </div>
  )
}

function MemberCard({ member, recipientId }: { member: TeamMember; recipientId: string }) {
  const staff = staffByName(member.name)
  // Messages can start a conversation with active staff only.
  const canMessage = staff?.status === 'active'
  return (
    <li
      className={cn(
        'card flex flex-col p-4',
        // The primary caregiver is the one on site daily
        member.primary && 'ring-brand-500 ring-2',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={member.name} decorative className="size-12 text-base" />
          <div className="min-w-0">
            <h3 className="text-ink truncate text-base font-semibold">
              {member.name}
            </h3>
            <p
              className={cn(
                'mt-0.5 text-sm font-medium',
                roleColour[member.role],
              )}
            >
              {member.role}
            </p>
          </div>
        </div>

        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
            statusChip[member.status],
          )}
        >
          {statusLabel[member.status]}
        </span>
      </div>

      {/* Grid on the dl itself — a wrapper div inside a dl must contain the
          dt/dd pair directly, so it can't be used purely for layout. */}
      <dl className="border-line mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4">
        <div className="col-span-2 min-w-0">
          <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
            Specialization
          </dt>
          <dd className="text-ink mt-0.5 text-sm break-words">
            {member.specialization}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
            Schedule
          </dt>
          <dd className="text-ink mt-0.5 text-sm break-words">
            {member.schedule}
          </dd>
        </div>

        <Field label="Hours Logged" value={member.hoursThisMonth} />

        <div className="min-w-0">
          <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
            Rating
          </dt>
          <dd className="text-ink mt-0.5 flex items-center gap-1 text-sm">
            {member.rating > 0 ? (
              <>
                <Star
                  className="size-3.5 shrink-0 fill-amber-400 text-amber-500"
                  aria-hidden="true"
                />
                <span className="tabular-nums">
                  {member.rating.toFixed(1)}/5.0
                </span>
              </>
            ) : (
              <span className="text-ink-subtle">Not rated</span>
            )}
          </dd>
        </div>

        <div className="col-span-2">
          <dt className="text-ink-subtle text-[0.65rem] font-semibold tracking-wider uppercase">
            Certifications
          </dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {member.certifications.length === 0 ? (
              <span className="text-ink-subtle text-xs">None recorded</span>
            ) : (
              member.certifications.map((c) => (
                <span
                  key={c}
                  className="border-line text-ink-muted inline-flex items-center rounded-md border px-2 py-0.5 text-xs"
                >
                  {c}
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>

      <div className="border-line mt-4 space-y-2 border-t pt-4">
        <div className="grid grid-cols-2 gap-2">
          {canMessage ? (
            <Link
              to={`/messages?with=caregiver:${staff.id}`}
              className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors"
            >
              <MessageSquare className="size-4" strokeWidth={1.9} aria-hidden="true" />
              Message
              <span className="sr-only"> {member.name}</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title={`${member.name} isn't an active staff member, so there's no inbox to message.`}
              className="border-control text-ink inline-flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border text-sm font-medium opacity-50"
            >
              <MessageSquare className="size-4" strokeWidth={1.9} aria-hidden="true" />
              Message
            </button>
          )}
          <Link
            to={`/care-recipients/${recipientId}/caregivers/${member.id}/reassign`}
            className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors"
          >
            Reassign
            <span className="sr-only"> {member.name}</span>
          </Link>
        </div>
        {/* The staff record, not the roster — nine cards promising nine
            different profiles all landed on the same list. */}
        <Link
          to={
            staffByName(member.name)
              ? `/caregivers/${staffByName(member.name)!.id}/overview`
              : '/caregivers'
          }
          className="bg-brand-50 text-brand-700 hover:bg-brand-100 flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors"
        >
          View Profile
          <span className="sr-only"> for {member.name}</span>
        </Link>
      </div>
    </li>
  )
}

export function CareTeamCards({ team, recipientId }: { team: TeamMember[]; recipientId: string }) {
  return (
    <section aria-labelledby="primary-care-team">
      <h2
        id="primary-care-team"
        className="text-ink mb-3 text-base font-semibold tracking-tight"
      >
        Primary Care Team
      </h2>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {team.map((m) => (
          <MemberCard key={m.id} member={m} recipientId={recipientId} />
        ))}
      </ul>
    </section>
  )
}
