import { useId } from 'react'
import Dialog from './Dialog.jsx'

/**
 * Asked before a term switch throws away unsaved allocation work.
 *
 * Switching term re-fetches everything, and the session's pending edits describe
 * classes in the term being left — they cannot be carried across. Nor should
 * they be: `pending` is keyed by class id and Save writes every pending class,
 * so edits held over from a term nobody is looking at would ride along
 * invisibly into the next save.
 *
 * So the work is genuinely lost, and the only honest thing is to say so before
 * it happens rather than after. Mounted only when there is something to lose —
 * a confirmation on a no-op switch is the kind of prompt people learn to click
 * through, which is what makes the next one useless.
 *
 * Cancel is the safe default and holds focus, so Enter or Escape on an
 * accidental switch keeps the work. The destructive action has to be aimed at.
 */
export default function DiscardChangesDialog({ term, classCount = 0, onCancel, onConfirm }) {
  const titleId = useId()
  const descId = useId()

  if (!term) return null

  // Width is left to Dialog's own max-w-md. Passing a narrower one through
  // `className` would put two max-width utilities on the same element, and which
  // of them wins is Tailwind's sort order rather than anything visible here — a
  // coin flip dressed up as a style.
  return (
    <Dialog open onClose={onCancel} labelledBy={titleId}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <span className="bg-warn/15 text-warn mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 2.8 18 16.4H2L10 2.8Z" strokeLinejoin="round" />
              <path d="M10 8v3.4M10 13.6v.4" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-fg text-sm leading-tight font-bold">
              Discard unsaved changes?
            </h2>
            <p id={descId} className="text-muted mt-1.5 text-[12px] leading-snug">
              You have allocation changes to{' '}
              <span className="text-fg font-semibold">
                {classCount} class{classCount === 1 ? '' : 'es'}
              </span>{' '}
              that have not been saved. Moving to{' '}
              <span className="text-fg font-semibold">{term.label}</span> reloads the
              schedule and these changes will be lost.
            </p>
          </div>
        </div>
      </div>

      <footer className="border-line bg-surface-2 flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3">
        {/* autoFocus, so the recoverable choice is the one a stray Enter takes. */}
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="border-line hover:border-line-strong text-fg cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors"
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="bg-danger cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:brightness-110"
        >
          Discard and switch
        </button>
      </footer>
    </Dialog>
  )
}
