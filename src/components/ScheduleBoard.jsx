import { useState } from 'react'
import { DAYS, groupForBoard } from '../domain/schedule.js'
import ClassPill from './ClassPill.jsx'
import ClassDialog from './ClassDialog.jsx'

/**
 * The weekly board: five day columns, split morning over afternoon.
 *
 * One CSS grid rather than five independent columns, so the dividing rule sits
 * at the same height in every column regardless of how many sessions each day
 * holds. Per-column flex layouts drift apart the moment one day has an extra
 * class.
 *
 * Columns are equal fractions with `min-w-0`, so they compress to whatever width
 * is available instead of forcing a horizontal scrollbar. Vertical overflow is
 * handled by this component's own scroll container — the page never scrolls.
 */

const GRID_ROWS = 'auto minmax(0,1fr) auto minmax(0,1fr)'

function cellClass(index, extra = '') {
  return `min-w-0 px-1.5 sm:px-2.5 ${index > 0 ? 'border-l border-rule/40' : ''} ${extra}`
}

function PeriodRail() {
  return (
    <div
      className="hidden w-5 shrink-0 sm:grid"
      style={{ gridTemplateRows: GRID_ROWS }}
      aria-hidden="true"
    >
      <div />
      <div className="flex items-center justify-center">
        <span className="text-subtle rotate-180 text-[10px] font-semibold tracking-wide [writing-mode:vertical-rl]">
          Morning
        </span>
      </div>
      <div />
      <div className="flex items-center justify-center">
        <span className="text-subtle rotate-180 text-[10px] font-semibold tracking-wide [writing-mode:vertical-rl]">
          Afternoon
        </span>
      </div>
    </div>
  )
}

function Sessions({ classes, onOpen }) {
  if (classes.length === 0) {
    return (
      <div className="flex h-full items-start justify-center pt-2">
        <span className="text-subtle/50 text-[11px]">—</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {classes.map((cls) => (
        <ClassPill key={cls.id} cls={cls} onOpen={onOpen} />
      ))}
    </div>
  )
}

export default function ScheduleBoard({ classes, orphaned = [] }) {
  const { grid, unscheduled } = groupForBoard(classes)

  // Held by id rather than by object so the open dialog follows the record if
  // the class list is refetched underneath it.
  const [openId, setOpenId] = useState(null)
  const openClass = classes.find((c) => c.id === openId) ?? null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 gap-1 overflow-y-auto px-3 py-4 sm:px-4">
        <PeriodRail />

        <div className="grid min-w-0 flex-1 grid-cols-5" style={{ gridTemplateRows: GRID_ROWS }}>
          {/* Row 1 — day headings */}
          {DAYS.map((day, i) => (
            <div key={`h-${day}`} className={cellClass(i, 'pb-3 text-center')}>
              <span className="text-fg text-[13px] font-bold tracking-[-0.01em]">{day}</span>
            </div>
          ))}

          {/* Row 2 — morning */}
          {DAYS.map((day, i) => (
            <div key={`m-${day}`} className={cellClass(i)}>
              <Sessions classes={grid[day].Morning} onOpen={(c) => setOpenId(c.id)} />
            </div>
          ))}

          {/* Row 3 — hairline rule per column, as in the printed schedule */}
          {DAYS.map((day, i) => (
            <div key={`r-${day}`} className={cellClass(i, 'flex items-center')}>
              <div className="bg-rule/70 my-3 h-px w-full" />
            </div>
          ))}

          {/* Row 4 — afternoon */}
          {DAYS.map((day, i) => (
            <div key={`a-${day}`} className={cellClass(i)}>
              <Sessions classes={grid[day].Afternoon} onOpen={(c) => setOpenId(c.id)} />
            </div>
          ))}
        </div>
      </div>

      {/* Anything that could not be placed is surfaced, never silently dropped. */}
      {(unscheduled.length > 0 || orphaned.length > 0) && (
        <div className="border-line bg-warn/10 shrink-0 space-y-1 border-t px-4 py-2">
          {unscheduled.length > 0 && (
            <p className="text-warn text-[11px]">
              {unscheduled.length} class{unscheduled.length === 1 ? '' : 'es'} not shown —
              missing day or time: {unscheduled.map((c) => c.Name).join(', ')}
            </p>
          )}
          {orphaned.length > 0 && (
            <p className="text-warn text-[11px]">
              {orphaned.length} class{orphaned.length === 1 ? '' : 'es'} not shown — no
              location set, so they cannot be filtered to a site:{' '}
              {orphaned.map((c) => c.Name).join(', ')}
            </p>
          )}
        </div>
      )}

      <ClassDialog cls={openClass} open={!!openClass} onClose={() => setOpenId(null)} />
    </div>
  )
}
