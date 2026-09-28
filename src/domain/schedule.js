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
 *
 * Accepts both ":" and "." as the minute separator. Class records use colons,
 * but the enrolment form's session slots use dots ("Fridays 2pm - 4.30pm"),
 * and preference matching parses both sides through this one function.
 */
export function startMinutes(timeText) {
  const m = String(timeText ?? '').match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let hour = Number(m[1]) % 12
  const mins = Number(m[2] ?? 0)
  if (/pm/i.test(m[3])) hour += 12
  return hour * 60 + mins
}

/** "Mondays" / "Monday" / "mondays " → "Monday"; anything else → null. */
function dayOf(line) {
  const word = String(line).trim().split(/\s+/)[0] ?? ''
  const singular = word.replace(/s$/i, '').toLowerCase()
  return DAYS.find((d) => d.toLowerCase() === singular) ?? null
}

/**
 * A session slot — a day word plus a start time — read out of free text.
 *
 * One parser, two sources that describe the same slots in different hands: the
 * enrolment form's ranked preference lines ("Mondays 10am - 12.45pm") and the
 * Selected Programs List's session times ("Mondays 2:00pm - 4:15pm", and in one
 * case a trailing "(AEDT)"). Plural and singular day names, dot and colon
 * minute separators, drifting spacing — none of it matters to a human reader
 * and all of it would break a string comparison, so both sides parse.
 *
 * `day`/`start` are null when the text cannot be read; `raw` is kept either
 * way, because the line still means something to a person even when it means
 * nothing to the matcher.
 *
 * @returns {{ raw: string, day: string|null, start: number|null }}
 */
export function parseSlot(text) {
  const raw = String(text ?? '').trim()
  return { raw, day: dayOf(raw), start: startMinutes(raw) }
}

/** "Tue 10am" / "Wed 2:30pm" — a slot at card size. Falls back to the raw text. */
export function formatSlot(slot) {
  if (!slot) return null
  if (slot.day == null || slot.start == null) return slot.raw || null

  const h24 = Math.floor(slot.start / 60)
  const mins = slot.start % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const suffix = h24 >= 12 ? 'pm' : 'am'
  const time = mins > 0 ? `${h12}:${String(mins).padStart(2, '0')}${suffix}` : `${h12}${suffix}`
  return `${slot.day.slice(0, 3)} ${time}`
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
