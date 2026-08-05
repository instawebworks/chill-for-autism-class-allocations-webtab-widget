/**
 * Loading state.
 *
 * Mirrors the loaded shell exactly — same header, same two panels, same board
 * grid — so nothing shifts when data arrives. The pill counts match a typical
 * term, so the columns settle rather than rearranging under the reader.
 *
 * Fills the iframe (`h-full`) and never scrolls the page, matching the app.
 */

const DAYS = [
  { name: 'Monday', morning: 3, afternoon: 3 },
  { name: 'Tuesday', morning: 2, afternoon: 4 },
  { name: 'Wednesday', morning: 2, afternoon: 4 },
  { name: 'Thursday', morning: 3, afternoon: 3 },
  { name: 'Friday', morning: 3, afternoon: 1 },
]

const GRID_ROWS = 'auto minmax(0,1fr) auto minmax(0,1fr)'
const PILL_WIDTHS = ['w-full', 'w-[93%]', 'w-[86%]', 'w-[97%]']
const TIME_WIDTHS = ['w-16', 'w-20', 'w-14', 'w-[4.5rem]']

function cellClass(index, extra = '') {
  return `min-w-0 px-1.5 sm:px-2.5 ${index > 0 ? 'border-l border-rule/40' : ''} ${extra}`
}

function SessionPlaceholder({ index }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div className={`skeleton h-7 rounded-full ${PILL_WIDTHS[index % PILL_WIDTHS.length]}`} />
      <div className={`skeleton h-2 rounded-full ${TIME_WIDTHS[index % TIME_WIDTHS.length]}`} />
    </div>
  )
}

function SessionGroup({ count, offset = 0 }) {
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {Array.from({ length: count }, (_, i) => (
        <SessionPlaceholder key={i} index={i + offset} />
      ))}
    </div>
  )
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

/**
 * Just the two panels, without the header above them.
 *
 * Split out for the term switch, which re-fetches everything but keeps the
 * header mounted — the picker that triggered the load must not vanish under the
 * cursor that used it. Same markup either way, so the two loading states cannot
 * drift apart.
 *
 * Carries the live region itself rather than leaving it to the caller: this is
 * the part that is actually busy in both uses.
 */
export function PanelsSkeleton({ label = 'Loading schedule…' }) {
  return (
    <div
      className="flex min-h-0 flex-1 gap-3 px-4 pb-4 sm:px-6 sm:pb-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>

      <aside className="border-line bg-surface flex w-[clamp(200px,17%,300px)] shrink-0 flex-col gap-3 overflow-hidden rounded-2xl border p-4">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-9 w-full rounded-lg" />
        <div className="skeleton h-9 w-full rounded-lg" />
        <div className="skeleton h-9 w-[85%] rounded-lg" />
      </aside>

      <main className="border-line bg-surface min-w-0 flex-1 overflow-hidden rounded-2xl border">
        <div className="flex h-full min-h-0 gap-1 px-3 py-4 sm:px-4">
          <PeriodRail />
          <div className="grid min-w-0 flex-1 grid-cols-5" style={{ gridTemplateRows: GRID_ROWS }}>
            {DAYS.map((day, i) => (
              <div key={`h-${day.name}`} className={cellClass(i, 'flex justify-center pb-3')}>
                <div className="skeleton h-3.5 w-20 rounded-full" />
              </div>
            ))}
            {DAYS.map((day, i) => (
              <div key={`m-${day.name}`} className={cellClass(i)}>
                <SessionGroup count={day.morning} />
              </div>
            ))}
            {DAYS.map((day, i) => (
              <div key={`r-${day.name}`} className={cellClass(i, 'flex items-center')}>
                <div className="bg-rule/70 my-3 h-px w-full" />
              </div>
            ))}
            {DAYS.map((day, i) => (
              <div key={`a-${day.name}`} className={cellClass(i)}>
                <SessionGroup count={day.afternoon} offset={1} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function TimetableSkeleton({ label = 'Loading schedule…' }) {
  return (
    <div className="bg-bg flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-start justify-between gap-4 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
        <div className="min-w-0 flex-1">
          <div className="skeleton h-6 w-72 max-w-full rounded-lg sm:h-7" />
          <div className="skeleton mt-2 h-3 w-48 max-w-full rounded-full" />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="skeleton h-6 w-16 rounded-lg sm:w-20" />
            <div className="bg-brand/60 animate-pulse-soft h-2 w-2 rounded-full" />
          </div>
          <div className="skeleton h-1.5 w-14 rounded-full" />
        </div>
      </header>

      <PanelsSkeleton label={label} />
    </div>
  )
}
