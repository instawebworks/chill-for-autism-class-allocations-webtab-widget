import { useDroppable } from '@dnd-kit/core'
import { capacityOf } from '../domain/classes.js'
import { programLabel } from '../domain/schedule.js'
import { normaliseHex, readableTextOn, withAlpha } from '../domain/colour.js'
import { useAllocations } from '../state/Allocations.jsx'
import { classDroppableId, useBoard } from '../state/Board.jsx'
import { evaluateAllocation } from '../domain/eligibility.js'

/**
 * One session on the board: programme name in a pill, time beneath.
 *
 * The fill comes from the record's own `Class_Color_Code`, not from a table in
 * this file. Adding a programme or restyling the palette is then a CRM edit
 * rather than a code change and a deploy.
 *
 * Text colour is computed from the fill rather than fixed, because the palette
 * spans near-black (#006636 money) to near-white (#9CC0E4 life) and either fixed
 * choice is unreadable at one end.
 *
 * Falls back to a neutral surface when the field is missing or holds something
 * that is not a hex colour — a pill with no colour is still a usable pill.
 */
export default function ClassPill({ cls, onOpen }) {
  const { rosterFor } = useAllocations()
  const { dwellEnabled, dwellMs, activeAdmission } = useBoard()
  const { setNodeRef, isOver } = useDroppable({ id: classDroppableId(cls.id) })
  const label = programLabel(cls.Program)

  // Judged while the card is still in the air, so an impossible target says so
  // before the user spends the dwell on it.
  const verdict = activeAdmission
    ? evaluateAllocation({ cls, admission: activeAdmission, roster: rosterFor(cls) })
    : null
  const blocked = verdict != null && !verdict.ok
  // Counts the pending roster, so the badge falls the moment a student is
  // un-allocated in the dialog rather than waiting for a save.
  const taken = rosterFor(cls).length
  const capacity = capacityOf(cls)

  const fill = normaliseHex(cls.Class_Color_Code)
  const text = fill ? readableTextOn(fill) : undefined

  // The badge sits on a scrim that pushes *away* from the text colour: a dark
  // scrim under white text, a light scrim under dark text. Tinting toward the
  // text — the intuitive-looking choice — moves background and foreground
  // together and destroys the contrast it appears to add; measured across all
  // sixteen programme colours it bottomed out at 3.1:1, below AA. Pushing apart
  // instead keeps the worst case at 6.5:1.
  const onWhiteText = text === '#ffffff'
  const badgeBg = text
    ? withAlpha(onWhiteText ? '#000000' : '#ffffff', onWhiteText ? 0.22 : 0.3)
    : undefined

  return (
    // A real <button>, not a div with onClick: the pill is the entry point to
    // the roster, so it has to be reachable and operable from the keyboard.
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen?.(cls)}
      className={`relative flex w-full min-w-0 cursor-pointer flex-col items-center gap-1 rounded-full text-left transition-transform ${
        isOver ? 'scale-[1.04]' : 'hover:scale-[1.02] active:scale-[0.99]'
      }`}
      aria-label={`${cls.Program}, ${cls.Class_Day} ${cls.Class_Time}, ${taken} of ${capacity} seats taken`}
    >
      {/**
       * The seat badge is pinned to the right edge rather than sitting beside
       * the name. Down a column the badges then line up in a fixed vertical
       * strip, so remaining capacity can be read in one pass instead of hunting
       * for a number that shifts left and right with each programme's name
       * length. The name centres in the space that is left.
       */}
      <div
        className={`relative flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-full border py-1.5 pr-1.5 pl-2.5 ${
          fill ? '' : 'bg-surface-3 border-line-strong'
        } ${
          isOver
            ? `ring-offset-bg ring-2 ring-offset-2 ${
                blocked
                  ? verdict.tone === 'danger'
                    ? 'ring-danger'
                    : 'ring-warn'
                  : 'ring-brand-strong'
              }`
            : ''
        }`}
        style={
          fill
            ? {
                backgroundColor: fill,
                borderColor: withAlpha('#ffffff', 0.16),
                color: text,
              }
            : undefined
        }
        title={`${cls.Program} · ${cls.Name}`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-center text-[13px] leading-tight font-semibold ${
            fill ? '' : 'text-fg'
          }`}
        >
          {label}
        </span>
        {capacity > 0 && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-px text-[10px] leading-[1.35] font-semibold tabular-nums ${
              fill ? '' : 'bg-surface text-subtle'
            }`}
            style={fill ? { backgroundColor: badgeBg } : undefined}
            title={`${taken} of ${capacity} seats taken`}
          >
            {taken}/{capacity}
          </span>
        )}

        {/*
          Dwell meter. The spring-open is invisible until it happens, so without
          this the user has no way to learn that resting on a class does
          anything — they read the pause as the drag having stuck. The bar runs
          for exactly as long as the timer, so it doubles as the countdown.
        */}
        {isOver && dwellEnabled && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.75">
            <span
              className="animate-dwell block h-full w-full bg-white/85"
              style={{ '--dwell-duration': `${dwellMs}ms` }}
            />
          </span>
        )}
      </div>
      <span className="text-muted w-full truncate text-center text-[11px] leading-none">
        {cls.Class_Time}
      </span>
    </button>
  )
}
