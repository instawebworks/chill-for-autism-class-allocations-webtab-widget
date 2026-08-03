import { CREATOR_OK, creatorUrl } from './config.js'
import { fetchWithTimeout } from '../lib/timeout.js'
import { canProxy, proxyGetJson } from '../crm/http.js'

/**
 * Terms, from the Creator app's public getTermBreakTerms function.
 *
 * Raw shape:
 *   { result: { data: [ { id, Start_Date, End_Date, Term_Year,
 *                         Term_Name, Display_Order } ] }, code: 3000 }
 */

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

  // Display_Order is unreliable: Term 4 carries "" while Terms 1-3 carry 2,3,4.
  // Kept for reference but never used for ordering — see sortTerms below.
  const rawOrder = Number(row.Display_Order)
  const displayOrder = Number.isFinite(rawOrder) ? rawOrder : null

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
 * Today (3 Aug 2026) sits in the 86-day gap between Term 3 and Term 4, so rule
 * 2 applies and Term 4 2026 is the target.
 *
 * Rule 3 is a safety net rather than a stated requirement: if every term is in
 * the past there is no future term to pick, and returning the most recent one
 * beats returning nothing and blocking the widget. `basis` is reported so the
 * UI can be honest about which rule fired.
 *
 * @returns {{ term: Term|null, basis: 'current'|'next'|'past'|'none' }}
 */
export function resolveTargetTerm(terms, when = new Date()) {
  const sorted = sortTerms(terms ?? [])

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
  if (body?.code !== CREATOR_OK) {
    throw new Error(
      `getTermBreakTerms returned code ${body?.code}: ${body?.description ?? 'unknown'}`,
    )
  }

  const rows = body?.result?.data
  if (!Array.isArray(rows)) throw new Error('getTermBreakTerms returned no data array')

  return sortTerms(rows.map(normalise))
}

export async function fetchTerms() {
  const url = creatorUrl('getTermBreakTerms')

  // Preferred path: let the CRM host make the call. It originates from Zoho's
  // servers, so the browser's same-origin policy is never involved.
  if (canProxy()) {
    return unwrap(await proxyGetJson(url, { label: 'getTermBreakTerms' }))
  }

  // Fallback for contexts without the SDK proxy. Subject to CORS, and will fail
  // until the calling origin is whitelisted in Creator.
  const res = await fetchWithTimeout(url, {
    ms: 15000,
    label: 'getTermBreakTerms',
    headers: { Accept: 'application/json' },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok && body?.code !== 2945) {
    throw new Error(`getTermBreakTerms failed: HTTP ${res.status}`)
  }
  return unwrap(body)
}
