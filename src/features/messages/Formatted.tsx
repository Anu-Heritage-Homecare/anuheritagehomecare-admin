import { Fragment } from 'react'
import { isBreak, richPieces } from './rich-text'

/**
 * An announcement's body, with the formatting the composer wrote rendered
 * back. The markup never reaches the DOM as markup: it is parsed into runs and
 * each run is rendered as text in a styled span.
 */
export function Formatted({ body }: { body: string }) {
  return (
    <>
      {richPieces(body).map((piece, i) => {
        if (isBreak(piece)) return <br key={i} />
        if (!piece.bold && !piece.italic && !piece.underline)
          return <Fragment key={i}>{piece.text}</Fragment>
        return (
          <span
            key={i}
            className={[
              piece.bold ? 'font-bold' : '',
              piece.italic ? 'italic' : '',
              piece.underline ? 'underline' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {piece.text}
          </span>
        )
      })}
    </>
  )
}
