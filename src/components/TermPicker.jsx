import { useEffect, useId, useRef, useState } from 'react'
import { useData } from '../crm/DataProvider.jsx'
import { useAllocations } from '../state/Allocations.jsx'
import DiscardChangesDialog from './DiscardChangesDialog.jsx'

/**
 * Term selector for the whole view.
 *
 * Built as a listbox to match LocationPicker exactly — same roles, same keyboard
 * map, same dismissal — because the two sit side by side in the header and a
 * pair of controls that look alike must behave alike.
 *
 * What is different is the cost of using it. Location re-filters records already
 * in memory; term re-fetches everything, and throws away any unsaved allocation
 * work in the process. So this one asks first, and only when there is something
 * to lose — see DiscardChangesDialog.
 *
 * The trigger stays interactive while the refetch runs, and shows the term being
 * moved to rather than the one still on the board. Disabling it would mean the
 * control vanishes from under the pointer that just used it, and re-reading the
 * old term would look like the click had not registered.
 */

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <rect x="2.2" y="3.4" width="11.6" height="10.4" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.2 6.6h11.6M5.6 1.9v2.6M10.4 1.9v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

const RANGE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

export default function TermPicker() {
  const { terms, selectedTerm, setTerm, loading } = useData()
  const { hasChanges, changedClassCount } = useAllocations()

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  // The term a confirmation is currently asking about. Null when nothing is
  // pending confirmation, which is also what closes the dialog.
  const [confirming, setConfirming] = useState(null)

  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listboxId = useId()

  const selectedIndex = Math.max(
    0,
    terms.findIndex((t) => t.id === selectedTerm?.id),
  )

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (terms.length === 0) {
    return (
      <span className="border-line bg-surface text-subtle inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm">
        <CalendarIcon />
        No terms
      </span>
    )
  }

  const openList = (index = selectedIndex) => {
    setActiveIndex(index)
    setOpen(true)
  }

  const choose = (index) => {
    const term = terms[index]
    setOpen(false)
    buttonRef.current?.focus()

    // Picking the term already loaded is not a switch, so it never warrants a
    // warning — and must not re-fetch either.
    if (!term || term.id === selectedTerm?.id) return

    if (hasChanges) {
      setConfirming(term)
      return
    }
    setTerm(term.id)
  }

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % terms.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + terms.length) % terms.length)
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(terms.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(activeIndex)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
        aria-label="Term"
        aria-busy={loading}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="border-line bg-surface hover:border-line-strong text-fg inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
      >
        <CalendarIcon />
        <span className="truncate">{selectedTerm?.label ?? 'Select term'}</span>
        <svg
          viewBox="0 0 16 16"
          className={`text-subtle h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Term"
          tabIndex={-1}
          className="border-line bg-surface-2 animate-rise absolute top-full left-0 z-50 mt-1.5 max-h-72 w-max min-w-full overflow-y-auto rounded-xl border p-1 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)]"
        >
          {terms.map((term, i) => {
            const isSelected = term.id === selectedTerm?.id
            return (
              <li
                key={term.id}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActiveIndex(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                  i === activeIndex ? 'bg-surface-3' : ''
                }`}
              >
                <span className={`min-w-0 flex-1 truncate ${isSelected ? 'text-fg font-medium' : 'text-muted'}`}>
                  {term.label}
                  {/* Dates are what actually distinguish two terms — the names
                      repeat every year, and the feed spans year boundaries. */}
                  <span className="text-subtle ml-1.5 text-xs">
                    {RANGE_FMT.format(term.start)} — {RANGE_FMT.format(term.end)}
                  </span>
                </span>
                {isSelected && (
                  <svg viewBox="0 0 16 16" className="text-brand h-3.5 w-3.5 shrink-0" fill="none">
                    <path
                      d="M3.5 8.5 6.5 11.5 12.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <DiscardChangesDialog
        term={confirming}
        classCount={changedClassCount}
        onCancel={() => {
          setConfirming(null)
          buttonRef.current?.focus()
        }}
        onConfirm={() => {
          const target = confirming
          setConfirming(null)
          if (target) setTerm(target.id)
        }}
      />
    </div>
  )
}
