import { lookupName } from './classes.js'

/**
 * Filtering the waiting queue by a typed query.
 *
 * The queue runs to three figures in a real term — 103 at the time this was
 * written — which is past the point where scrolling is a way of finding
 * anybody. Searching is how you answer "where is this student", and the two
 * things a person has to hand are the name someone said to them and the
 * admission number off an invoice or an email.
 *
 * ---------------------------------------------------------------------------
 * A lens, never the truth
 * ---------------------------------------------------------------------------
 *
 * This filters what is DISPLAYED and nothing else — exactly like the location
 * scope. It must never reach the allocated/waiting calculation: a student
 * hidden by a search is still waiting, and judging "is anyone left to place"
 * against a filtered list would report an empty queue to anyone mid-search.
 *
 * ---------------------------------------------------------------------------
 * Matching rules
 * ---------------------------------------------------------------------------
 *
 * Every whitespace-separated token must match somewhere, so word order does not
 * matter: "mcewan charles" finds Charles McEwan, and "charles 37" narrows to
 * one card. Tokens are matched case-insensitively as substrings against the
 * student name and the admission number together.
 *
 * Admission numbers additionally match on their digits alone, because they are
 * zero-padded and nobody types "ADM-00036". "36", "0036" and "ADM-36" all find
 * ADM-00036. That comparison is exact rather than a substring: plain substring
 * matching already handles the loose cases via the haystack, and letting "36"
 * also drag in ADM-00136 and ADM-00360 would bury the record actually asked for.
 */

/** Digits only, with leading zeros dropped: "ADM-00036" and "adm 36" → "36". */
function digitsOf(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
}

/**
 * Does one admission answer this query?
 *
 * An empty or whitespace-only query matches everything, so callers do not have
 * to special-case "not searching".
 */
export function admissionMatches(admission, query) {
  const tokens = String(query ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length === 0) return true

  const student = (lookupName(admission?.Student_Name) ?? '').toLowerCase()
  const admissionNo = String(admission?.Name ?? '').toLowerCase()
  const haystack = `${student} ${admissionNo}`
  const numberPart = digitsOf(admissionNo)

  return tokens.every((token) => {
    if (haystack.includes(token)) return true
    const asNumber = digitsOf(token)
    return asNumber !== '' && asNumber === numberPart
  })
}

/** The admissions a query leaves visible, in the order they were given. */
export function searchAdmissions(admissions = [], query) {
  if (String(query ?? '').trim() === '') return admissions
  return admissions.filter((admission) => admissionMatches(admission, query))
}
