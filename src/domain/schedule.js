/**
 * Arranging Class records into the weekly board.
 *
 * The board is days across, morning/afternoon down — the same shape as the
 * printed programme schedule.
 */

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const PERIODS = ['Morning', 'Afternoon']

/**
 * Minutes past midnight for the start of a time range like "10am - 12:30pm"
 * or "2pm - 4:45pm". Returns null when unparseable, so callers can decide
 * rather than silently sorting an unknown to the top.
 */
export function startMinutes(timeText) {
  const m = String(timeText ?? '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let hour = Number(m[1]) % 12
  const mins = Number(m[2] ?? 0)
  if (/pm/i.test(m[3])) hour += 12
  return hour * 60 + mins
}

/**
 * Morning or afternoon. Class_Type carries this, but it is a picklist that can
 * be left empty, so the start time is used as a fallback rather than dropping
 * the class off the board.
 */
export function periodOf(cls) {
  const declared = cls?.Class_Type
  if (declared === 'Morning' || declared === 'Afternoon') return declared
  const start = startMinutes(cls?.Class_Time)
  if (start == null) return null
  return start < 12 * 60 ? 'Morning' : 'Afternoon'
}

/**
 * Display name for a pill. Every programme is prefixed "Chill " in CRM, which
 * is pure noise repeated 28 times on one screen — the printed schedule drops it
 * too. Casing is left alone so "Neuromance B" stays legible.
 */
export function programLabel(program) {
  return String(program ?? '').replace(/^chill\s+/i, '') || 'Unnamed'
}

/**
 * Bucket classes by day and period.
 *
 * Anything that cannot be placed — no day, or no period and no readable time —
 * is returned in `unscheduled` rather than discarded. A class missing from the
 * board with no trace is the failure mode to avoid: the board looks complete.
 */
export function groupForBoard(classes = []) {
  const grid = Object.fromEntries(
    DAYS.map((day) => [day, Object.fromEntries(PERIODS.map((p) => [p, []]))]),
  )
  const unscheduled = []

  for (const cls of classes) {
    const day = cls?.Class_Day
    const period = periodOf(cls)
    if (!DAYS.includes(day) || !period) {
      unscheduled.push(cls)
      continue
    }
    grid[day][period].push(cls)
  }

  for (const day of DAYS) {
    for (const period of PERIODS) {
      grid[day][period].sort((a, b) => {
        const sa = startMinutes(a.Class_Time)
        const sb = startMinutes(b.Class_Time)
        if (sa == null) return 1
        if (sb == null) return -1
        if (sa !== sb) return sa - sb
        return programLabel(a.Program).localeCompare(programLabel(b.Program))
      })
    }
  }

  return { grid, unscheduled }
}

/** Largest number of classes in any one cell — used to size the board's rows. */
export function maxPerPeriod(grid, period) {
  return Math.max(1, ...DAYS.map((day) => grid[day][period].length))
}
