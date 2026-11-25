import { Link, Outlet, useMatch, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ProfileHeader } from '@/features/care-recipients/profile/ProfileHeader'
import { ProfileTabs } from '@/features/care-recipients/profile/ProfileTabs'
import { actionsForTab } from '@/features/care-recipients/profile/tabs'
import { useRecipientProfile } from '@/features/care-recipients/useRecipientProfile'

export function RecipientProfilePage() {
  const { id } = useParams()
  // Matched rather than sliced out of the pathname, so a basename or a deeper
  // nesting can't silently yield the wrong slug.
  const activeTab = useMatch('/care-recipients/:id/:tab')?.params.tab
  const { data: profile, isPending, isError, error, refetch } = useRecipientProfile(id)

  if (isPending) {
    return (
      <div className="card text-ink-subtle flex items-center justify-center gap-2 px-6 py-20 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading care recipient…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <h1 className="text-ink text-lg font-semibold">Could not load this care recipient</h1>
        <p className="text-ink-muted mt-1 text-sm">{error.message}</p>
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
          >
            Try again
          </button>
          <Link
            to="/care-recipients"
            className="border-control text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
          >
            Back to directory
          </Link>
        </div>
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
