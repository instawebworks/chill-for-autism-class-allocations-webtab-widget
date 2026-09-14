import { normaliseHex } from './colour.js'

/**
 * The identity of a programme, as opposed to the name of one record.
 *
 * The two sides of every programme comparison spell the name differently, in
 * three ways — all audited against live CRM data (every Term 4 class vs every
 * enrolment form name, 14 Sep 2026):
 *
 *   1. Numeric instance PREFIX on classes: "01_Chill Plus" / "02_Chill Plus"
 *      are two sessions of the programme families enrol in as "Chill Plus".
 *   2. Numeric instance SUFFIX on classes: "Chill No Problem_01" / "_02" vs
 *      the form's "Chill No Problem".
 *   3. Connector words dropped on classes: "Chill Stage" / "Chill Screen" /
 *      "Chill Grill" vs the form's "Chill on Stage" / "Chill on Screen" /
 *      "Chill on the Grill".
 *
 * So identity is what is left after the instance markers, the "Chill " brand
 * prefix, and the connectors "on"/"the" go. Verified collision-free across the
 * full programme list — no two real programmes differ only by these.
 *
 * NOT stripped, deliberately: a trailing letter. "Chill Neuromance" and
 * "Chill Neuromance B" are BOTH offered on the enrolment form as distinct
 * programmes, so the "B" is a real distinction, not an instance marker.
 *
 * Every programme comparison and lookup must go through this — matching on the
 * raw field is exactly the bug that refused a Chill Plus admission entry to a
 * 01_Chill Plus class.
 */
export function programKey(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\d+\s*[_\-.]\s*/, '') // instance prefix: "01_", "2 - ", "3."
    .replace(/[_\-.\s]*\d+$/, '') // instance suffix: "_01", " 2"
    .replace(/^chill\s+/i, '')
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '' && word !== 'on' && word !== 'the')
    .join(' ')
}

/**
 * Programme → colour, derived from the Class records currently loaded.
 *
 * Colours live on Classes, not Admissions, so an admission has no colour of its
 * own. Rather than inventing a second palette, the waiting list borrows the
 * colour of a class teaching the same programme — the same "Art" is the same
 * yellow whether it is a session on the board or a student waiting for one.
 *
 * Keyed by programKey, so "01_Chill Plus" supplies the colour a "Chill Plus"
 * admission looks up. Look up with `colourForProgram`, never `map.get(raw)`.
 *
 * Consequence worth knowing: a programme with no class in the current term and
 * location has no colour to borrow, and renders neutral.
 */
export function programColours(classes = []) {
  const map = new Map()
  for (const cls of classes) {
    const key = programKey(cls?.Program)
    const hex = normaliseHex(cls?.Class_Color_Code)
    if (key && hex && !map.has(key)) map.set(key, hex)
  }
  return map
}

/** A programme's colour by any spelling of its name, or undefined. */
export function colourForProgram(colours, name) {
  return colours?.get(programKey(name))
}
