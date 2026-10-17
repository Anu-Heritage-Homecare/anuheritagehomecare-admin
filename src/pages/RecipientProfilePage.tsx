import { useMemo } from 'react'
import { Link, Outlet, useMatch, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getRecipientProfile } from '@/features/care-recipients/profile-data'
import { ProfileHeader } from '@/features/care-recipients/profile/ProfileHeader'
import { ProfileTabs } from '@/features/care-recipients/profile/ProfileTabs'
import { actionsForTab } from '@/features/care-recipients/profile/tabs'

export function RecipientProfilePage() {
  const { id } = useParams()
  // Matched rather than sliced out of the pathname, so a basename or a deeper
  // nesting can't silently yield the wrong slug.
  const activeTab = useMatch('/care-recipients/:id/:tab')?.params.tab
  // Stable identity: the lookup builds a fresh object each call, which would
  // otherwise invalidate the Outlet context on every render.
  const profile = useMemo(() => (id ? getRecipientProfile(id) : undefined), [id])

  if (!profile) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <h1 className="text-ink text-lg font-semibold">
          Care recipient not found
        </h1>
        <p className="text-ink-muted mt-1 text-sm">
          No record matches{' '}
          <code className="text-ink-subtle break-all">{id}</code>.
        </p>
        <Link
          to="/care-recipients"
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
        >
          Back to directory
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link
        to="/care-recipients"
        className="text-ink-muted hover:text-ink inline-flex items-center gap-1.5 text-sm font-medium print:hidden"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        Care Recipients
      </Link>

      <div className="card overflow-hidden">
        <ProfileHeader profile={profile} actions={actionsForTab(activeTab)} />
        <ProfileTabs recipientId={profile.id} />
      </div>

      {/* `key` remounts panels when switching person, so scroll and any local
          panel state don't carry across records. */}
      <Outlet key={profile.id} context={profile} />
    </div>
  )
}
