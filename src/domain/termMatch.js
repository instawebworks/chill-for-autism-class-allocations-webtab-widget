/**
 * Matching CRM records to a term.
 *
 * The term is stored differently in each module, and none of it is a lookup:
 *
 *   Classes     Select_Term    picklist  "Term 4"
 *               Academic_Year  text      "2026"
 *   Admissions  Term           text      "Term 4 2026"
 *               Academic_Year  text      "2026"
 *
 * All 28 Classes and 3 Admissions currently hold exactly those shapes, so a
 * strict equality check would work today. It is parsed rather than compared
 * because `Term` is free text a human can edit — "Term 4, 2026" or a stray
 * double space would silently drop records from the timetable, and a silently
 * short timetable looks correct.
 */

/** Pull the term number and year out of any reasonable free-text spelling. */
export function parseTermText(text) {
  if (!text) return null
  const s = String(text)
  const num = s.match(/term\s*(\d+)/i)
  const year = s.match(/\b(20\d{2})\b/)
  if (!num) return null
  return {
    number: Number(num[1]),
    year: year ? Number(year[1]) : null,
  }
}

function termNumberOf(term) {
  return parseTermText(term?.name)?.number ?? null
}

function yearOf(value) {
  const n = Number(String(value ?? '').trim())
  return Number.isFinite(n) && n > 1900 ? n : null
}

/**
 * Does a Classes record belong to `term`?
 * Matches on the picklist term number plus Academic_Year.
 */
export function classInTerm(cls, term) {
  const want = termNumberOf(term)
  const got = parseTermText(cls?.Select_Term)?.number
  if (want == null || got == null) return false
  return got === want && yearOf(cls?.Academic_Year) === term.year
}

/**
 * Does an Admissions record belong to `term`?
 *
 * `Term` normally carries both parts ("Term 4 2026"). Where it carries only the
 * term ("Term 4"), Academic_Year supplies the year rather than the record being
 * discarded.
 */
export function admissionInTerm(adm, term) {
  const want = termNumberOf(term)
  const parsed = parseTermText(adm?.Term)
  if (want == null || !parsed) return false

  const year = parsed.year ?? yearOf(adm?.Academic_Year)
  return parsed.number === want && year === term.year
}

/**
 * Does an Enrollments record belong to `term`?
 *
 * `Term` carries both parts ("Term 4 2026") and the module has no
 * Academic_Year to fall back on, so a line missing its year cannot match.
 * Term-break enrolments hold a null Term and are excluded, correctly — they
 * have no in-term classes to prefer.
 */
export function enrollmentInTerm(enr, term) {
  const want = termNumberOf(term)
  const parsed = parseTermText(enr?.Term)
  if (want == null || !parsed) return false
  return parsed.number === want && parsed.year === term.year
}

/**
 * Zoho search criteria for the same question, used to narrow the fetch
 * server-side. Kept deliberately loose — it is an optimisation, never the
 * correctness boundary. Whatever comes back is still passed through the
 * matchers above, so a loose or over-broad server match cannot leak
 * wrong-term records into the timetable.
 */
export function classTermCriteria(term) {
  return `(Select_Term:equals:${term.name})and(Academic_Year:equals:${term.year})`
}

export function admissionTermCriteria(term) {
  return `(Term:equals:${term.label})`
}

/** Enrollments store the term the same way Admissions do. */
export function enrollmentTermCriteria(term) {
  return `(Term:equals:${term.label})`
}
