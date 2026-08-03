import { useEffect, useId, useRef, useState } from 'react'
import { useWorkspace } from '../state/Workspace.jsx'

/**
 * Location selector for the whole view.
 *
 * A custom listbox rather than a native <select>: a native control renders with
 * the OS's own light-mode chrome, which reads as a foreign object on this navy
 * surface. The trade is that accessibility has to be built rather than
 * inherited, so this implements the listbox pattern properly — roles, active
 * descendant, full keyboard control, focus return, and click-outside dismissal.
 *
 * Always interactive, including when the org has a single location: the control
 * should behave the same way regardless of how many sites exist, so it stays
 * openable and shows what the list actually contains.
 */

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M8 1.8c2.3 0 4.2 1.9 4.2 4.2 0 3-4.2 8.2-4.2 8.2S3.8 9 3.8 6c0-2.3 1.9-4.2 4.2-4.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" />
    </svg>
  )
}

export default function LocationPicker() {
  const { locations, locationId, selectedLocation, setLocationId } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listboxId = useId()

  const selectedIndex = Math.max(
    0,
    locations.findIndex((l) => l.id === locationId),
  )

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (locations.length === 0) {
    return (
      <span className="border-line bg-surface text-subtle inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm">
        <PinIcon />
        No locations
      </span>
    )
  }

  const openList = (index = selectedIndex) => {
    setActiveIndex(index)
    setOpen(true)
  }

  const choose = (index) => {
    setLocationId(locations[index].id)
    setOpen(false)
    buttonRef.current?.focus()
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
        setActiveIndex((i) => (i + 1) % locations.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + locations.length) % locations.length)
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(locations.length - 1)
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
        aria-label="Location"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="border-line bg-surface hover:border-line-strong text-fg inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
      >
        <PinIcon />
        <span className="truncate">{selectedLocation?.Name ?? 'Select location'}</span>
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
          aria-label="Location"
          tabIndex={-1}
          className="border-line bg-surface-2 animate-rise absolute top-full left-0 z-50 mt-1.5 max-h-72 w-max min-w-full overflow-y-auto rounded-xl border p-1 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)]"
        >
          {locations.map((loc, i) => {
            const isSelected = loc.id === locationId
            return (
              <li
                key={loc.id}
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
                  {loc.Name}
                  {loc.Location_Code && (
                    <span className="text-subtle ml-1.5 text-xs">{loc.Location_Code}</span>
                  )}
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
    </div>
  )
}
