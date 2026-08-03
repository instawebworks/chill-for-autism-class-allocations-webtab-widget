import { capacityOf, occupancyOf } from '../domain/classes.js'
import { programLabel } from '../domain/schedule.js'
import { normaliseHex, readableTextOn, withAlpha } from '../domain/colour.js'

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
  const label = programLabel(cls.Program)
  const taken = occupancyOf(cls)
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
      type="button"
      onClick={() => onOpen?.(cls)}
      className="flex w-full min-w-0 cursor-pointer flex-col items-center gap-1 rounded-full text-left transition-transform hover:scale-[1.02] active:scale-[0.99]"
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
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-full border py-1.5 pr-1.5 pl-2.5 ${
          fill ? '' : 'bg-surface-3 border-line-strong'
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
      </div>
      <span className="text-muted w-full truncate text-center text-[11px] leading-none">
        {cls.Class_Time}
      </span>
    </button>
  )
}
