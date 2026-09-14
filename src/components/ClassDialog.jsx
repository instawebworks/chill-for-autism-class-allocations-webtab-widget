import { useId, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import Dialog from './Dialog.jsx'
import Checkbox from './Checkbox.jsx'
import { parseRoster } from '../domain/allocations.js'
import { capacityOf, lookupName } from '../domain/classes.js'
import { programLabel } from '../domain/schedule.js'
import { shadeForWhiteText } from '../domain/colour.js'
import { evaluateAllocation } from '../domain/eligibility.js'
import { ordinal, preferenceRankFor } from '../domain/preferences.js'
import { useAllocations } from '../state/Allocations.jsx'
import { DIALOG_DROP_ID, useBoard } from '../state/Board.jsx'

/**
 * The students allocated to one class.
 *
 * Un-ticking a student un-allocates them: the row leaves this list immediately
 * and their card reappears in the waiting panel, ready to be placed again.
 * Nothing is written to CRM — the change is held until Save.
 *
 * The list therefore renders the *pending* roster rather than the loaded one.
 * Undo is not a second click here but the card on the left, which is why the
 * row can safely disappear.
 *
 * Every visible row is by definition still allocated, so each checkbox is drawn
 * ticked; the tick is the "in this class" state and clearing it is the action.
 */

/**
 * Mounted only while a class is open — see the call site in ScheduleBoard. The
 * `useDroppable` registration below must not outlive the element it describes.
 */
export default function ClassDialog({ cls, onClose }) {
  const titleId = useId()
  const { deallocate, rosterRowsFor } = useAllocations()
  const { isDragging, activeAdmission, activePreferences } = useBoard()
  // The whole panel is the drop target, not just the list: once the dialog has
  // sprung open the user is already moving toward it, and asking them to find a
  // smaller zone inside it would waste the gesture.
  const { setNodeRef, isOver } = useDroppable({ id: DIALOG_DROP_ID })
  const roster = useMemo(() => (cls ? parseRoster(cls) : null), [cls])
  const rows = cls ? rosterRowsFor(cls) : []

  if (!cls) return null

  // Header uses a darkened shade so the text is always white — see
  // shadeForWhiteText for why the header does not follow the pill's rule.
  const header = shadeForWhiteText(cls.Class_Color_Code)
  const capacity = capacityOf(cls)

  // The same verdict the drop itself will apply, so the zone can never invite a
  // drop that is about to be refused.
  // `rows` is already this class's pending roster, so it is the roster the rule
  // needs — no second lookup, and no chance of the two disagreeing.
  const verdict = activeAdmission
    ? evaluateAllocation({ cls, admission: activeAdmission, roster: rows })
    : null
  const blocked = verdict != null && !verdict.ok

  // Named in the drop zone so the confirmation moment — roster in view, about
  // to release — also says how much the family wanted this slot. Any rank is
  // worth stating here: unlike the board, one line about one class is never
  // noise, and "their 9th preference" is exactly the pause-for-thought a low
  // rank should cause.
  const rank = activeAdmission && !blocked ? preferenceRankFor(activePreferences, cls) : null

  const removeAll = () => {
    for (const row of rows) {
      if (row.admissionId) deallocate(cls, row.admissionId)
    }
  }

  return (
    <Dialog
      open
      onClose={isDragging ? () => {} : onClose}
      labelledBy={titleId}
      dropRef={setNodeRef}
      className={
        isDragging
          ? `ring-2 ring-offset-2 ring-offset-transparent ${
              isOver ? 'ring-brand-strong' : 'ring-brand/40'
            }`
          : ''
      }
    >
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
        <p className="text-fg text-[12px] font-semibold">Allocated students</p>
        {/* Seats count the pending roster, not the loaded one, so the number
            drops the instant a student is un-allocated. */}
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
        <ul className="divide-line min-h-0 flex-1 divide-y overflow-y-auto">
          {rows.map((row) => (
            <li key={row.key}>
              {/* Name and admission number share one line, name left and
                  number right. Down the list the numbers form a single
                  right-hand column, and each student is one row instead of
                  two — the same reason the waiting-list cards were folded. */}
              <label className="hover:bg-surface-2 flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors">
                {/* Always ticked: an unticked row would have left the list. */}
                <Checkbox
                  checked
                  onChange={() => row.admissionId && deallocate(cls, row.admissionId)}
                  label={`Un-allocate ${row.studentName || 'this student'} from ${programLabel(cls.Program)}`}
                />
                <span className="text-fg min-w-0 flex-1 truncate text-[13px] font-medium">
                  {row.studentName || 'Unnamed student'}
                </span>
                <span className="text-muted shrink-0 font-mono text-[12px] font-bold">
                  {row.admissionNo || '—'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {/* Where the card lands. Shown only mid-drag, and only as a target — the
          panel as a whole accepts the drop, so this is a signpost rather than a
          hit area the user has to aim at. */}
      {isDragging && (
        <div className="border-line shrink-0 border-t px-5 py-3">
          {/* States the verdict up front rather than accepting the drop and
              explaining afterwards. The reason is the rule's own wording, so it
              matches the banner the refusal would raise. */}
          <div
            className={`flex items-center justify-center rounded-xl border border-dashed px-3 py-3 text-center text-[12px] font-medium transition-colors ${
              blocked
                ? verdict.tone === 'danger'
                  ? 'border-danger/60 bg-danger/10 text-danger'
                  : verdict.tone === 'warn'
                    ? 'border-warn/60 bg-warn/10 text-warn'
                    : 'border-line-strong text-muted'
                : isOver
                  ? 'border-brand-strong bg-brand/15 text-brand-strong'
                  : 'border-line-strong text-subtle'
            }`}
          >
            {blocked
              ? verdict.title
              : `${isOver ? 'Release to allocate' : 'Drop here to allocate'}${
                  rank ? ` — their ${ordinal(rank)} preference` : ''
                }`}
          </div>
        </div>
      )}

      {rows.length > 1 && (
        <footer className="border-line bg-surface-2 shrink-0 border-t px-5 py-2.5">
          <button
            type="button"
            onClick={removeAll}
            className="text-brand-strong text-[12px] font-medium hover:underline"
          >
            Un-allocate all
          </button>
        </footer>
      )}
    </Dialog>
  )
}
