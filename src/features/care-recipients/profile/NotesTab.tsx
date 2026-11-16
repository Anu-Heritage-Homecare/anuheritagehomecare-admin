import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ArrowUpDown, Loader2, NotebookPen, Search, UserRound } from 'lucide-react'
import type { RecipientProfile } from '../profile-data'
import { useAcknowledgeNote, useRecipientNotes } from '../useRecipientNotes'
import {
  NOTES_PAGE_SIZE,
  authors,
  categoryCounts,
  flaggedCount,
  noteCategories,
  noteSortOptions,
  notesThisMonth,
  sortNotes,
  TODAY,
  type NoteCategory,
  type NoteSort,
} from '../notes-data'
import { NoteCard } from './NoteCard'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { cn } from '@/lib/cn'

type CategoryFilter = NoteCategory | 'all'

export function NotesTab() {
  const profile = useOutletContext<RecipientProfile>()
  const { data, isPending, isError, error, refetch } = useRecipientNotes(profile.id)
  const acknowledge = useAcknowledgeNote(profile.id)
  const notes = useMemo(() => data ?? [], [data])

  const [category, setCategory] = useState<CategoryFilter>('all')
  const [author, setAuthor] = useState('all')
  const [sort, setSort] = useState<NoteSort>('latest')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(NOTES_PAGE_SIZE)

  // Acknowledged ids off the mapped notes, so the filtered/sorted rows (typed
  // as the base note without the flag) can still show the state.
  const acknowledgedIds = useMemo(
    () => new Set(notes.filter((n) => n.acknowledged).map((n) => n.id)),
    [notes],
  )

  const flagged = flaggedCount(notes)
  const thisMonth = notesThisMonth(notes)
  const authorOptions = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...authors(notes).map((a) => ({ value: a, label: a })),
    ],
    [notes],
  )

  /*
   * Pill counts respect the author filter and the search, so they can't read
   * "Visit Notes 5" above a list showing one. Category is applied after, since
   * a pill shouldn't affect its own count.
   */
  const beforeCategory = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes.filter((n) => {
      if (author !== 'all' && n.author !== author) return false
      if (!q) return true
      return [n.body, n.author, n.authorRole]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [notes, author, query])

  const counts = useMemo(() => categoryCounts(beforeCategory), [beforeCategory])

  const rows = useMemo(() => {
    const filtered =
      category === 'all'
        ? beforeCategory
        : beforeCategory.filter((n) => n.category === category)
    return sortNotes(filtered, sort)
  }, [beforeCategory, category, sort])

  const shown = rows.slice(0, visible)
  const remaining = rows.length - shown.length

  /** Any filter change restarts the reveal count. */
  const reset =
    <T,>(setter: (v: T) => void) =>
    (value: T) => {
      setter(value)
      setVisible(NOTES_PAGE_SIZE)
    }

  // One way: the DTO's `acknowledged` is the source of truth, so a tick posts
  // the acknowledgement and the re-read reflects it. Already acknowledged notes
  // do not post again.
  const acknowledgeNote = (id: string) => {
    if (!acknowledgedIds.has(id)) acknowledge.mutate(id)
  }

  if (isPending) {
    return (
      <div className="card text-ink-subtle flex items-center justify-center gap-2 px-6 py-20 text-sm">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        Loading care notes…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <h2 className="text-ink text-sm font-semibold">Could not load care notes</h2>
        <p className="text-ink-muted mt-1 text-sm">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="card grid place-items-center px-6 py-20 text-center">
        <span className="bg-sunken text-ink-subtle grid size-11 place-items-center rounded-full">
          <NotebookPen className="size-5" strokeWidth={1.8} />
        </span>
        <h2 className="text-ink mt-3 text-sm font-semibold">No care notes</h2>
        <p className="text-ink-muted mt-1 max-w-sm text-sm">
          {profile.name} has no logged notes yet. Caregiver, clinical and family
          entries appear here as they are recorded.
        </p>
        <button
          type="button"
          className="bg-brand-600 hover:bg-brand-700 mt-5 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors"
        >
          Add Note
        </button>
      </div>
    )
  }

  const monthName = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${TODAY}T00:00:00Z`))

  const stats = [
    {
      id: 'total',
      label: 'Total Notes',
      value: String(notes.length),
      hint: 'All cumulative logs since onboarding',
      emphasise: false,
    },
    {
      id: 'month',
      label: 'This Month',
      value: String(thisMonth),
      hint: `New activity logs in ${monthName}`,
      emphasise: false,
    },
    {
      id: 'flagged',
      label: 'Flagged for Review',
      value: String(flagged),
      hint: 'Requiring supervisor attention',
      emphasise: flagged > 0,
    },
  ]

  return (
    <div className="space-y-4">
      <section aria-labelledby="notes-snapshot">
        <h2
          id="notes-snapshot"
          className="text-ink mb-3 text-base font-semibold tracking-tight"
        >
          Notes Summary Snapshot
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map(({ id, label, value, hint, emphasise }) => (
            <article
              key={id}
              className={cn(
                'card p-4',
                emphasise && 'border-red-200 bg-red-50/40',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-ink-subtle text-xs font-semibold tracking-wider uppercase">
                  {label}
                </p>
                {emphasise && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-semibold text-red-700">
                    Attention required
                  </span>
                )}
              </div>
              <p
                className={cn(
                  'mt-2 text-3xl font-bold tracking-tight tabular-nums',
                  emphasise ? 'text-red-700' : 'text-ink',
                )}
              >
                {value}
              </p>
              <p className="text-ink-subtle mt-1.5 text-xs">{hint}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Chips, search and the two selects are one row in the design, so they
          share a single wrapping flex line rather than sitting in two stacked
          rows. The search grows into whatever is left and shrinks before the
          line breaks, which keeps it on one line down to tablet widths. */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Filter notes by category"
          className="flex flex-wrap items-center gap-2"
        >
          {(
            [
              { value: 'all' as const, label: 'All' },
              ...noteCategories.map((c) => ({
                value: c.value,
                label: c.label,
              })),
            ] satisfies { value: CategoryFilter; label: string }[]
          ).map(({ value, label }) => {
            const selected = category === value
            const count =
              value === 'all' ? beforeCategory.length : counts[value]
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => reset(setCategory)(value)}
                // Outlined when idle, filled when chosen, and the count is a
                // badge either way — as plain text beside the label it read as
                // part of the category's name.
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm font-medium transition-colors sm:min-h-9.5',
                  selected
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-control bg-surface text-ink hover:bg-sunken',
                )}
              >
                {label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                    selected
                      ? 'bg-brand-500 text-white'
                      : 'bg-sunken text-ink-muted',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* A small basis, not a min-width: flex wraps on the basis before it
            shrinks anything, so a roomy one would push Sort onto a second line
            at 1280px of content. It grows into whatever is left instead. */}
        <div className="relative w-full sm:w-auto sm:min-w-0 sm:flex-1 sm:basis-32">
          <Search
            aria-hidden="true"
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => reset(setQuery)(e.target.value)}
            aria-label="Search care notes"
            placeholder="Search care notes..."
            className="border-control bg-surface text-ink placeholder:text-ink-subtle focus:border-brand-400 h-11 w-full rounded-lg border pr-3 pl-8.5 text-sm sm:h-9.5"
          />
        </div>

        <SelectFilter
          label="Author"
          chip
          icon={UserRound}
          value={author}
          onChange={reset(setAuthor)}
          options={authorOptions}
          className="grow sm:grow-0"
        />
        <SelectFilter
          label="Sort"
          chip
          icon={ArrowUpDown}
          value={sort}
          onChange={(v) => reset(setSort)(v as NoteSort)}
          options={noteSortOptions}
          className="grow sm:grow-0"
        />
      </div>

      {/* Filtering otherwise changes the result set silently */}
      <p aria-live="polite" className="text-ink-muted text-sm">
        {rows.length === 0
          ? 'No care notes match these filters'
          : `Showing ${shown.length} of ${rows.length} notes`}
      </p>

      {rows.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-ink-subtle text-sm">
            No care notes match these filters.
          </p>
        </div>
      ) : (
        <section aria-label="Care notes">
          <ul className="space-y-3">
            {shown.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                acknowledged={acknowledgedIds.has(note.id)}
                onAcknowledge={acknowledgeNote}
              />
            ))}
          </ul>
        </section>
      )}

      {/* aria-disabled, not disabled: a focused button that becomes `disabled`
          is pulled out of the focus order and the browser resets focus to
          <body>, so the final click would strand a keyboard user. */}
      {rows.length > NOTES_PAGE_SIZE && (
        <div className="text-center">
          <button
            type="button"
            onClick={() =>
              remaining > 0 && setVisible((v) => v + NOTES_PAGE_SIZE)
            }
            aria-disabled={remaining === 0}
            className="border-line text-ink hover:bg-sunken inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium transition-colors aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
          >
            {remaining === 0 ? 'All notes shown' : 'Load More Notes'}
            {remaining > 0 && (
              <span className="text-ink-subtle ml-1.5">({remaining})</span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
