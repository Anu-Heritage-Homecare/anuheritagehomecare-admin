/**
 * The announcement composer's formatting.
 *
 * The first version of this put `**marks**` in the text, which is what you
 * write in a plain box — but the design draws a toolbar over a box where the
 * words themselves go bold, and marks left sitting in the message when nothing
 * was selected. So the editor is a real rich-text box now and what is stored
 * is a tiny, closed vocabulary of HTML: bold, italic, underline and line
 * breaks, and nothing else.
 *
 * Nothing that arrives here is trusted. Everything is parsed into runs and the
 * stored markup is rebuilt from those runs, so whatever the browser's editor
 * produces — or anything pasted into it — comes out as only those four things.
 */
export type Mark = 'bold' | 'italic' | 'underline'

export interface RichRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
}

/** A run, or the break between two lines. */
export type RichPiece = RichRun | { br: true }

export function isBreak(piece: RichPiece): piece is { br: true } {
  return 'br' in piece
}

const BOLD = /^(B|STRONG)$/
const ITALIC = /^(I|EM)$/
const BLOCK = /^(DIV|P|LI|H[1-6])$/

/** Splits stored markup into the runs a renderer can style. */
export function richPieces(html: string): RichPiece[] {
  const out: RichPiece[] = []
  const doc = new DOMParser().parseFromString(
    `<body>${html ?? ''}</body>`,
    'text/html',
  )
  walk(doc.body, { bold: false, italic: false, underline: false }, out)
  return out
}

function walk(
  node: Node,
  style: { bold: boolean; italic: boolean; underline: boolean },
  out: RichPiece[],
): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      const text = child.nodeValue ?? ''
      if (text !== '') out.push({ ...style, text })
      continue
    }
    if (child.nodeType !== 1) continue

    const name = child.nodeName
    if (name === 'BR') {
      out.push({ br: true })
      continue
    }
    // A block inside the editor is a new line, which is what Enter produces.
    if (BLOCK.test(name) && out.length > 0 && !isBreak(out[out.length - 1]))
      out.push({ br: true })

    walk(
      child,
      {
        bold: style.bold || BOLD.test(name),
        italic: style.italic || ITALIC.test(name),
        underline: style.underline || name === 'U',
      },
      out,
    )
  }
}

/** The stored form: rebuilt from the runs, so only these four tags survive. */
export function sanitizeRich(html: string): string {
  return richPieces(html)
    .map((piece) => {
      if (isBreak(piece)) return '<br>'
      let text = escapeHtml(piece.text)
      if (piece.underline) text = `<u>${text}</u>`
      if (piece.italic) text = `<i>${text}</i>`
      if (piece.bold) text = `<b>${text}</b>`
      return text
    })
    .join('')
}

/** The words alone, for a list row or a search. */
export function richToPlain(html: string): string {
  return richPieces(html)
    .map((piece) => (isBreak(piece) ? '\n' : piece.text))
    .join('')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
