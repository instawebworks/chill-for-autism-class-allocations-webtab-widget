import { useEffect, useId, useMemo, useState } from 'react'
import Dialog from './Dialog.jsx'
import Checkbox from './Checkbox.jsx'
import { parseRoster } from '../domain/allocations.js'
import { capacityOf, lookupName } from '../domain/classes.js'
import { programLabel } from '../domain/schedule.js'
import { shadeForWhiteText } from '../domain/colour.js'

/**
 * The students currently allocated to one class.
 *
 * Every row starts ticked. What the ticks do is not wired up yet — the state is
 * held here and surfaced through `onSelectionChange` so the action can be added
 * without restructuring anything.
 *
 * A roster row is keyed by its subform `rowId`, which is what identifies the row
 * to CRM for any later update. `admissionId` is the fallback for the
 * theoretically-possible row that has no id yet.
 */

function rowKey(row, index) {
  return row.rowId ?? row.admissionId ?? `row-${index}`
}

export default function ClassDialog({ cls, open, onClose, onSelectionChange }) {
  const titleId = useId()
  const roster = useMemo(() => (cls ? parseRoster(cls) : null), [cls])
  const rows = roster?.rows ?? []

  // Everyone selected on open, and reset whenever a different class is opened —
  // without the reset, ticks from the last class would carry over.
  const [selected, setSelected] = useState(() => new Set())
  useEffect(() => {
    if (!open || !cls) return
    setSelected(new Set(rows.map(rowKey)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cls?.id])

  useEffect(() => {
    onSelectionChange?.(selected)
  }, [selected, onSelectionChange])

  if (!cls) return null

  // Header uses a darkened shade so the text is always white — see
  // shadeForWhiteText for why the header does not follow the pill's rule.
  const header = shadeForWhiteText(cls.Class_Color_Code)
  const capacity = capacityOf(cls)

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const allSelected = rows.length > 0 && selected.size === rows.length

  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId}>
      {/* Header carries the programme colour so it is obvious which pill was
          opened, without repeating the whole board's context. */}
      <header
        className="shrink-0 px-5 py-4 text-white"
        style={header ? { backgroundColor: header } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-base leading-tight font-bold text-white">
              {programLabel(cls.Program)}
            </h2>
            {/* Secondary lines sit at 85% rather than 70%: on a dark header the
                extra transparency was costing more legibility than it bought in
                hierarchy. */}
            <p className="mt-1 truncate text-[12px] text-white/85">
              {cls.Class_Day} · {cls.Class_Time}
              {lookupName(cls.Classroom) ? ` · ${lookupName(cls.Classroom)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 shrink-0 rounded-lg p-1.5 text-white/70 transition-colors hover:text-white"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="mt-2.5 font-mono text-[10px] text-white/70">{cls.Name}</p>
      </header>

      <div className="border-line bg-surface-2 flex shrink-0 items-baseline justify-between gap-2 border-y px-5 py-2.5">
        <p className="text-fg text-[12px] font-semibold">
          Allocated students
          {rows.length > 0 && (
            <span className="text-subtle ml-1.5 font-normal">
              {selected.size} of {rows.length} selected
            </span>
          )}
        </p>
        <p className="text-muted shrink-0 text-[11px] font-bold tabular-nums">
          {rows.length}/{capacity} seats
        </p>
      </div>

      {roster.status === 'invalid' ? (
        <div className="px-5 py-8 text-center">
          <p className="text-warn text-xs">
            This class’s allocation data could not be read, so the student list
            cannot be shown.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <div className="bg-surface-3 text-subtle flex h-10 w-10 items-center justify-center rounded-full">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="10" cy="7" r="3" />
              <path d="M4 16c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-muted text-sm font-medium">No students allocated</p>
          <p className="text-subtle text-xs">
            {capacity > 0 ? `All ${capacity} seats are open.` : 'This class has no seats set.'}
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-[color:var(--border)] overflow-y-auto">
          {rows.map((row, i) => {
            const key = rowKey(row, i)
            const isOn = selected.has(key)
            return (
              <li key={key}>
                {/* Name and admission number share one line, name left and
                    number right. Down the list the numbers form a single
                    right-hand column, and each student is one row instead of
                    two — the same reason the waiting-list cards were folded. */}
                <label className="hover:bg-surface-2 flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors">
                  <Checkbox
                    checked={isOn}
                    onChange={() => toggle(key)}
                    label={`Select ${row.studentName ?? 'student'}`}
                  />
                  <span className="text-fg min-w-0 flex-1 truncate text-[13px] font-medium">
                    {row.studentName ?? 'Unnamed student'}
                  </span>
                  <span className="text-muted shrink-0 font-mono text-[12px] font-bold">
                    {row.admissionNo ?? '—'}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {rows.length > 1 && (
        <footer className="border-line bg-surface-2 shrink-0 border-t px-5 py-2.5">
          <button
            type="button"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(rows.map(rowKey)))
            }
            className="text-brand-strong text-[12px] font-medium hover:underline"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </footer>
      )}
    </Dialog>
  )
}
