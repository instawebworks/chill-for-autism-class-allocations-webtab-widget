import { formatSlot, parseSlot, startMinutes } from './schedule.js'

/**
 * Session preferences, from the Enrollment's Session_Preference_Order field.
 *
 * The field is the enrolment form's ranked slot list: one session slot per
 * line, most preferred first, e.g.
 *
 *   Tuesdays 10am - 12.30pm
 *   Mondays 10am - 12.45pm
 *   Wednesday 2pm - 4.30pm
 *
 * It is free text written by a form, and the live data is inconsistent in
 * every way that does not matter to a human reader: plural and singular day
 * names on adjacent lines, dot and colon minute separators, drifting spacing.
 * So a slot is *parsed* — day word plus start time — never string-compared,
 * the same rule termMatch.js applies to terms. A line that cannot be parsed
 * keeps its place in the ranking (the raw text still means something to a
 * person) but can never match a class.
 *
 * Everything here is a hint for the person allocating, not a rule: nothing in
 * this module may block an allocation, and an enrolment with no readable
 * preferences simply shows none.
 *
 * ---------------------------------------------------------------------------
 * NOT shown on the waiting cards any more — read this before putting it back
 * ---------------------------------------------------------------------------
 *
 * This list is per ENROLMENT, while a card is per ADMISSION, and one enrolment
 * produces one admission per programme. Showing `prefs[0]` on a card therefore
 * printed the same day and time on every programme a family took — which read
 * as though the widget had assigned them all to one slot. The cards now read
 * the per-programme Selected Programs List instead; see domain/selectedPrograms.js.
 *
 * Kept because the ranking is still real information about what the family
 * asked for, and is the obvious thing to surface when someone has to place a
 * student whose enrolled session has no class. It is just no longer allowed to
 * masquerade as the session they are enrolled in.
 */

/**
 * @typedef {{ raw: string, day: string|null, start: number|null, rank: number }} PreferenceSlot
 *   rank is 1-based — rank 1 is the family's first choice.
 */

/** Parse one enrolment's ranked slot list. Never throws; [] for blank/null. */
export function parseSessionPreferences(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw, i) => ({ ...parseSlot(raw), rank: i + 1 }))
}

/** Parsed preferences for every enrolment that has any, keyed by record id. */
export function preferencesByEnrollment(enrollments = []) {
  const map = new Map()
  for (const enr of enrollments) {
    const prefs = parseSessionPreferences(enr?.Session_Preference_Order)
    if (prefs.length > 0) map.set(enr.id, prefs)
  }
  return map
}

/**
 * The preference list behind an admission, via its Enrollment lookup.
 * Empty when the admission has no enrolment link or the enrolment gave none —
 * both mean the same thing here: nothing to show.
 */
export function preferencesForAdmission(admission, byEnrollment) {
  const id = admission?.Enrollment?.id
  return (id && byEnrollment?.get(id)) || []
}

/**
 * Where this class sits in a preference list: 1 for the first choice, null
 * when it matches no slot. Matched on day + start minute, so "Tuesdays
 * 10am - 12.30pm" finds the class stored as Tuesday "10am - 12:30pm".
 */
export function preferenceRankFor(prefs, cls) {
  const day = cls?.Class_Day
  const start = startMinutes(cls?.Class_Time)
  if (!day || start == null) return null
  return (prefs ?? []).find((p) => p.day === day && p.start === start)?.rank ?? null
}

/**
 * "Tue 10am" / "Wed 2:30pm" — a slot at card size.
 *
 * Delegates to the shared formatter so a preference and an enrolled session are
 * never rendered in two different shapes for the same time of day.
 */
export function shortSlot(pref) {
  return formatSlot(pref)
}

/** The whole ranking as a tooltip: "1. Tuesdays 10am - 12.30pm\n2. …". */
export function preferenceTitle(prefs = []) {
  if (prefs.length === 0) return null
  return prefs.map((p) => `${p.rank}. ${p.raw}`).join('\n')
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th"… */
export function ordinal(n) {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}
