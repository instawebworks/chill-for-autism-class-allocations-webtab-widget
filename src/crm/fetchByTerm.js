import { getAllRecords, PaginationError, searchAllRecords } from './api.js'

/**
 * Fetch a module's records for a term.
 *
 * Two-step, and the split matters:
 *
 *   1. Narrow server-side with a criteria search, so we do not drag every
 *      Admission ever created across the bridge. Admissions grow by roughly
 *      (students x programs) every term, so this is the difference between a
 *      constant-size fetch and one that degrades every term forever.
 *
 *   2. Filter whatever comes back through the local matcher, which is the
 *      actual correctness boundary. The server match is over free-text fields
 *      and is treated as a hint, never as proof.
 *
 * If the search fails — unsupported criteria syntax, an odd SDK response, a
 * field that is not searchable — it falls back to fetching the module and
 * filtering locally. Slower, but it returns the right answer instead of an
 * error, and it logs so the degradation is visible rather than silent.
 */
export async function fetchByTerm(module, { criteria, fields, matcher }) {
  let records
  let via = 'search'

  try {
    const res = await searchAllRecords(module, { criteria, fields })
    records = res.records

    // An empty search result is ambiguous: genuinely no matches, or a criteria
    // string this org rejects. Confirm against a full fetch rather than
    // reporting an empty timetable that might be a query bug.
    if (records.length === 0) {
      const all = await getAllRecords(module, { fields })
      records = all.records
      via = 'search-empty→full'
    }
  } catch (err) {
    // A pagination failure must not be retried as a full fetch. The search was
    // the *narrower* query — if that could not be read to completion, fetching
    // the whole module certainly cannot, and the fallback would either fail
    // again or, worse, succeed with a truncated set.
    if (err instanceof PaginationError) throw err

    console.warn(`[crm] ${module}: criteria search failed, falling back to full fetch.`, err)
    const all = await getAllRecords(module, { fields })
    records = all.records
    via = 'full'
  }

  const matched = matcher ? records.filter(matcher) : records
  console.info(`[crm] ${module}: ${matched.length}/${records.length} in term (via ${via})`)
  return matched
}
