import { DAYS, startMinutes } from './schedule.js'

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
 */

/**
 * @typedef {{ raw: string, day: string|null, start: number|null, rank: number }} PreferenceSlot
 *   rank is 1-based — rank 1 is the family's first choice.
 */

/** "Mondays" / "Monday" / "mondays " → "Monday"; anything else → null. */
function dayOf(line) {
  const word = String(line).trim().split(/\s+/)[0] ?? ''
  const singular = word.replace(/s$/i, '').toLowerCase()
  return DAYS.find((d) => d.toLowerCase() === singular) ?? null
}

/** Parse one enrolment's ranked slot list. Never throws; [] for blank/null. */
export function parseSessionPreferences(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw, i) => ({ raw, day: dayOf(raw), start: startMinutes(raw), rank: i + 1 }))
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

/** "Tue 10am" / "Wed 2:30pm" — a slot at card size. Falls back to the raw line. */
export function shortSlot(pref) {
  if (!pref) return null
  if (pref.day == null || pref.start == null) return pref.raw

  const h24 = Math.floor(pref.start / 60)
  const mins = pref.start % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const suffix = h24 >= 12 ? 'pm' : 'am'
  const time = mins > 0 ? `${h12}:${String(mins).padStart(2, '0')}${suffix}` : `${h12}${suffix}`
  return `${pref.day.slice(0, 3)} ${time}`
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
