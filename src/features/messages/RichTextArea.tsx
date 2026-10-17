import { useEffect, useImperativeHandle, useRef } from 'react'
import { cn } from '@/lib/cn'
import { sanitizeRich } from './rich-text'
import type { Mark } from './rich-text'

export interface RichTextHandle {
  focus: () => void
  /** Bold, italic or underline on the current selection. */
  toggle: (mark: Mark) => void
  /** Drops text in at the caret. */
  insert: (text: string) => void
}

/**
 * The announcement box: a real editable area, so the toolbar bolds the words
 * rather than typing marks around them.
 *
 * It is deliberately not re-rendered from `value` on every keystroke — writing
 * back into a live editable node moves the caret to the start, which is the
 * classic way these break. The parent is told what was typed; the node is only
 * written to when the two have genuinely diverged, which is how it is cleared
 * or filled from a draft.
 */
export function RichTextArea({
  value,
  onChange,
  placeholder,
  label,
  handle,
  className,
}: {
  value: string
  onChange: (html: string) => void
  placeholder: string
  label: string
  handle?: React.Ref<RichTextHandle>
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  /*
   * What this editor last handed up. Comparing against the node's own markup
   * instead was the bug that typed backwards: the browser's markup never
   * matches the sanitised copy exactly, so every keystroke rewrote the node
   * and put the caret back at the start. The node is only written to when the
   * value has changed somewhere other than in here.
   */
  const emitted = useRef(value)

  useEffect(() => {
    const node = box.current
    if (!node || value === emitted.current) return
    node.innerHTML = value
    emitted.current = value
  }, [value])

  const emit = (html: string) => {
    const clean = sanitizeRich(html)
    emitted.current = clean
    onChange(clean)
  }

  useImperativeHandle(handle, () => ({
    focus: () => box.current?.focus(),
    toggle: (mark: Mark) => {
      const node = box.current
      if (!node) return
      node.focus()
      // The editable-area commands. Deprecated in the specs and still the only
      // thing every browser implements; the result is sanitised on the way out
      // either way, so whatever markup a browser chooses does not matter.
      document.execCommand(mark, false)
      emit(node.innerHTML)
    },
    insert: (text: string) => {
      const node = box.current
      if (!node) return
      node.focus()
      document.execCommand('insertText', false, text)
      emit(node.innerHTML)
    },
  }))

  return (
    <div
      ref={box}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={(e) => emit(e.currentTarget.innerHTML)}
      onBlur={(e) => emit(e.currentTarget.innerHTML)}
      onPaste={(e) => {
        // Paste as words: the sanitiser would strip the rest anyway, and this
        // keeps a pasted email from dragging its own fonts in.
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
      }}
      className={cn(
        'text-ink w-full overflow-y-auto px-3 py-2.5 text-sm focus:outline-none',
        'empty:before:text-ink-subtle empty:before:content-[attr(data-placeholder)]',
        className,
      )}
    />
  )
}
