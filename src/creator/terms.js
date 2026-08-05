import { CREATOR_OK, creatorUrl } from './config.js'
import { fetchWithTimeout } from '../lib/timeout.js'
import { canProxy, proxyGetJson } from '../crm/http.js'

/**
 * Terms, from the Creator app's public getCurrentAndFutureTerms function.
 *
 * Raw shape:
 *   { result: { data: [ { id, Start_Date, End_Date, Term_Year,
 *                         Term_Name, Display_Order } ] }, code: 3000 }
 *
 * ---------------------------------------------------------------------------
 * The feed is already filtered — this is load-bearing
 * ---------------------------------------------------------------------------
 *
 * It returns Term 4 2026 and everything after it. Older terms are excluded at
 * the source and will never appear, so this module sees a window rather than a
 * history. Its predecessor, getTermBreakTerms, returned every term ever
 * recorded.
 *
 * That means "the earliest row" is no longer "the first term the org ran", and
 * anything that wants a genuinely historical term has to go elsewhere for it —
 * widening this endpoint is not the answer, because the exclusion is deliberate.
 *
 * What it does NOT change is the resolution rule below. Rules 1 and 2 only ever
 * looked forward from today, and every term they could have chosen is still
 * present. Rule 3 is the one that shifts meaning — see resolveTargetTerm.
 */

/** Named once: it is both the URL path and the label on every error. */
const TERMS_FN = 'getCurrentAndFutureTerms'

/**
 * Normalised term.
 * @typedef {{
 *   id: string, name: string, year: number, label: string,
 *   startDate: string, endDate: string, start: Date, end: Date,
 *   displayOrder: number|null,
 * }} Term
 */

function parseDate(iso) {
  // Dates arrive as plain YYYY-MM-DD with no zone. Pinning them to UTC noon
  // keeps them on the intended calendar day no matter the viewer's offset —
  // parsing "2026-10-06" as midnight UTC lands on 5 October in the Americas.
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function normalise(row) {
  const name = String(row.Term_Name ?? '').trim()
  const year = Number(row.Term_Year)

  // Display_Order is unreliable, and on this feed it is empty on every row —
  // the old one at least carried 2,3,4 for Terms 1-3. Kept for reference but
  // never used for ordering; see sortTerms below.
  //
  // Blank is checked as a string before any conversion, because Number('') is 0
  // and Number.isFinite(0) is true. Converting first would record every one of
  // those blanks as the ordering value zero — a real number, indistinguishable
  // from a term genuinely ordered first — instead of as the absence it is.
  const rawOrder = String(row.Display_Order ?? '').trim()
  const displayOrder = rawOrder !== '' && Number.isFinite(Number(rawOrder)) ? Number(rawOrder) : null

  return {
    id: String(row.id),
    name,
    year,
    label: year ? `${name} ${year}` : name,
    startDate: row.Start_Date,
    endDate: row.End_Date,
    start: parseDate(row.Start_Date),
    end: parseDate(row.End_Date),
    displayOrder,
  }
}

/**
 * Chronological order, by start date.
 *
 * Deliberately not by Display_Order (incomplete) and not by Term_Year + name
 * either: Term 1 2026 starts 22 Nov 2025, so a term's year is a label rather
 * than something derivable from its dates. Start date is the only field that
 * orders every row correctly.
 */
export function sortTerms(terms) {
  return [...terms].sort((a, b) => a.start - b.start)
}

/** The term containing `when`, or null if the date falls in a break. */
export function termAt(terms, when = new Date()) {
  return terms.find((t) => when >= t.start && when <= t.end) ?? null
}

/**
 * Resolve the term the widget works against. Everything loaded after this point
 * is scoped to it, so it is decided once, immediately after terms arrive.
 *
 * Rules, in order:
 *   1. the term containing today                    → basis 'current'
 *   2. otherwise the nearest term still to start    → basis 'next'
 *
 * Today (5 Aug 2026) falls before Term 4 2026 starts on 6 Oct, so rule 2 applies
 * and Term 4 is the target — the earliest row the feed carries.
 *
 * Rule 3 is a safety net rather than a stated requirement: with no future term
 * to pick, returning the most recent one beats returning nothing and blocking
 * the widget. `basis` is reported so the UI can be honest about which rule fired.
 *
 * Its meaning has changed, though, now that the feed excludes past terms. It
 * used to mean "the org has no terms scheduled ahead", reached by walking a full
 * history. Against a current-and-future feed it means the window itself has run
 * out — every term Creator is still publishing has finished, i.e. nobody has set
 * up the next one. Same fallback, but it is now a symptom rather than a state,
 * and it is the signal worth surfacing if the widget ever opens on a stale term.
 *
 * A `selectedId` outranks all three: once someone has picked a term from the
 * header, that is the answer and the rules are not consulted. It is still
 * checked against the list rather than trusted, because the feed is a moving
 * window — a term chosen earlier can roll out of it, and the rules are a better
 * answer then than an id matching nothing and a board with no classes on it.
 *
 * @param {Term[]} terms
 * @param {object} [opts]
 * @param {Date}   [opts.when]        treated as "today"
 * @param {string} [opts.selectedId]  a term the user picked explicitly
 * @returns {{ term: Term|null, basis: 'chosen'|'current'|'next'|'past'|'none' }}
 */
export function resolveTargetTerm(terms, { when = new Date(), selectedId = null } = {}) {
  const sorted = sortTerms(terms ?? [])

  if (selectedId) {
    const chosen = sorted.find((t) => t.id === String(selectedId))
    if (chosen) return { term: chosen, basis: 'chosen' }
  }

  const current = termAt(sorted, when)
  if (current) return { term: current, basis: 'current' }

  const next = sorted.find((t) => t.start > when)
  if (next) return { term: next, basis: 'next' }

  const last = sorted.at(-1) ?? null
  return { term: last, basis: last ? 'past' : 'none' }
}

function unwrap(body) {
  // Creator answers a rejected browser origin with 401 / code 2945 rather than
  // simply omitting CORS headers. Name it plainly — the fix is a Creator
  // permitted-domains setting, not anything in this codebase.
  if (body?.code === 2945) {
    throw new Error(
      'Creator rejected this origin (UNAUTHORIZED_CORS_REQUEST). Either route the call through the CRM proxy or add this domain to the published function’s permitted domains.',
    )
  }
  // The public key is issued per Custom API. Pointing an existing key at a newly
  // published function is the obvious mistake and this is what it looks like —
  // named so it is not mistaken for the endpoint being down. See creator/config.js.
  if (body?.code === 9370) {
    throw new Error(
      `${TERMS_FN}: Creator rejected the public key (9370). It is issued per Custom API, so check CREATOR_FUNCTIONS holds this function’s own key.`,
    )
  }
  if (body?.code !== CREATOR_OK) {
    throw new Error(`${TERMS_FN} returned code ${body?.code}: ${body?.description ?? 'unknown'}`)
  }

  const rows = body?.result?.data
  if (!Array.isArray(rows)) throw new Error(`${TERMS_FN} returned no data array`)

  return sortTerms(rows.map(normalise))
}

export async function fetchTerms() {
  const url = creatorUrl(TERMS_FN)

  // Preferred path: let the CRM host make the call. It originates from Zoho's
  // servers, so the browser's same-origin policy is never involved.
  if (canProxy()) {
    return unwrap(await proxyGetJson(url, { label: TERMS_FN }))
  }

  // Fallback for contexts without the SDK proxy. Subject to CORS, and will fail
  // until the calling origin is whitelisted in Creator.
  const res = await fetchWithTimeout(url, {
    ms: 15000,
    label: TERMS_FN,
    headers: { Accept: 'application/json' },
  })
  const body = await res.json().catch(() => null)
  // 2945 (CORS) and 9370 (bad key) both arrive as 401 with a readable body, and
  // unwrap() names each one. Falling through to a bare HTTP status would throw
  // away the only part of the answer that says what to fix.
  if (!res.ok && body?.code !== 2945 && body?.code !== 9370) {
    throw new Error(`${TERMS_FN} failed: HTTP ${res.status}`)
  }
  return unwrap(body)
}
