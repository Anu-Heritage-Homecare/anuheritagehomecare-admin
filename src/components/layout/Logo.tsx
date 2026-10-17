/**
 * The agency's own mark, from `public/icons/cp-icon.svg` — the blue one, the
 * same #3E64FF as `--color-brand-600`. It carries its own shield and colour,
 * so it is not sat on a brand-coloured tile the way the drawn placeholder was:
 * a tile would box a shape that is already a shape.
 *
 * The PNG this used to point at is no longer in `public/`, which is what left
 * a broken-image box beside the wordmark. Width and height match the file's
 * 38×41 viewBox, so nothing shifts while it loads.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/icons/cp-icon.svg"
        width={38}
        height={41}
        alt=""
        aria-hidden="true"
        className="h-9 w-auto shrink-0"
      />
      <span className="text-brand-700 text-lg font-bold tracking-tight">
        CAREPROFS
      </span>
    </div>
  )
}
