import { useEffect, useRef } from 'react'

/**
 * Modal dialog.
 *
 * Hand-rolled rather than pulled from a library, because the accessible parts
 * are the parts that matter and they are few: focus enters on open and returns
 * to whatever opened it on close, Tab is trapped inside, Escape and a backdrop
 * click dismiss, and the surroundings are hidden from assistive tech via
 * aria-modal.
 *
 * Returning focus is the piece most often skipped. Without it, dismissing the
 * dialog drops focus back to <body>, and a keyboard user has to tab from the top
 * of the page to get back to the pill they were just on.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * `dropRef` lets a caller observe the panel element as well — the allocation
 * dialog registers it as a drag-and-drop target. It is merged with the internal
 * ref rather than replacing it, because focus management still needs its own
 * handle on the same node.
 */
export default function Dialog({ open, onClose, labelledBy, children, className = '', dropRef }) {
  const panelRef = useRef(null)
  const restoreTo = useRef(null)

  useEffect(() => {
    if (!open) return

    restoreTo.current = document.activeElement

    // Focus the panel itself rather than the first control: reading the dialog's
    // heading before its inputs is the sane order for a screen reader.
    const id = requestAnimationFrame(() => panelRef.current?.focus())

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const items = panelRef.current?.querySelectorAll(FOCUSABLE)
      if (!items?.length) return

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('keydown', onKeyDown)
      // Guard against restoring focus to something that has since unmounted.
      if (restoreTo.current?.isConnected) restoreTo.current.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="animate-fade absolute inset-0 bg-[#040b16]/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={(node) => {
          panelRef.current = node
          if (typeof dropRef === 'function') dropRef(node)
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`border-line bg-surface animate-pop relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)] outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
