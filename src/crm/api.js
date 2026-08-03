/**
 * Thin wrapper over ZOHO.CRM.API.
 *
 * Only safe to call from inside <CrmProvider>, where the SDK is guaranteed live.
 * Deliberately unopinionated — no domain logic here, just the awkward parts of
 * the SDK surface smoothed over.
 */

import { withTimeout } from '../lib/timeout.js'

/** Zoho caps page size at 200 regardless of what you ask for. */
export const MAX_PER_PAGE = 200

/**
 * Raised when a result set cannot be read to completion. Distinct from a
 * transport failure: callers must not "retry differently" past this, because
 * every remaining strategy returns the same incomplete answer.
 */
export class PaginationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PaginationError'
  }
}

function api() {
  const crm = window.ZOHO?.CRM?.API
  if (!crm) throw new Error('ZOHO.CRM.API unavailable — called outside CRM?')
  return crm
}

/**
 * One page of records.
 * @param {string} module   API name, e.g. 'Classes'
 * @param {object} opts     { fields: string[], page, per_page, sort_by, sort_order }
 */
export async function getRecords(module, { fields, page = 1, per_page = MAX_PER_PAGE, ...rest } = {}) {
  // The SDK forwards this over a postMessage bridge and returns a promise that
  // never settles if the CRM host does not answer — so it needs a hard deadline
  // or a silent bridge failure becomes an eternal loading screen.
  const res = await withTimeout(
    api().getAllRecords({
      Entity: module,
      ...(fields ? { fields: fields.join(',') } : {}),
      page,
      per_page,
      ...rest,
    }),
    { ms: 20000, label: `${module} page ${page}` },
  )
  return { records: res?.data ?? [], info: res?.info ?? {} }
}

/**
 * Point past which page-number paging is not guaranteed by the newer REST API.
 * Used only to raise a one-off warning — see paginate().
 */
export const PAGE_LIMIT_RECORDS = 2000

/** Runaway guard. Far above any real term's data; a backstop, not a budget. */
export const HARD_RECORD_CAP = 20000

/**
 * Every record matching a request, following pagination to exhaustion.
 *
 * `info.more_records` is the contract. The widget SDK's info block is
 * `{ per_page, count, page, more_records }` — page numbers only, no cursor — so
 * the loop increments `page` and keeps going for exactly as long as the API says
 * there is more. `page_token` is still honoured if a response ever carries one,
 * costing nothing today and working automatically if the host moves to a newer
 * API version.
 *
 * Stops early, without erroring, when a page comes back empty: whatever
 * `more_records` claims, there is nothing further to read and continuing would
 * spin.
 *
 * Throws rather than returning a short list if it hits the runaway cap. A
 * partial timetable is the dangerous failure — it renders perfectly and is
 * quietly missing students, so it has to be an error, not a warning nobody reads.
 */
async function paginate(label, fetchPage, { hardCap = HARD_RECORD_CAP } = {}) {
  const out = []
  let page = 1
  let pageToken = null
  let warnedPastPageLimit = false

  for (;;) {
    const cursor = pageToken ? { page_token: pageToken } : { page }
    const { records, info } = await fetchPage(cursor)
    out.push(...records)

    // info.count is this page's row count. A disagreement means the response
    // shape is not what we think it is, which is worth knowing before it turns
    // into a quietly wrong record set.
    if (typeof info.count === 'number' && info.count !== records.length) {
      console.warn(
        `[crm] ${label} page ${page}: info.count=${info.count} but ${records.length} rows returned.`,
      )
    }

    if (out.length > hardCap) {
      throw new PaginationError(`${label}: exceeded ${hardCap} records — refusing to keep paging.`)
    }

    if (records.length === 0 || !info.more_records) return out

    if (info.next_page_token) {
      pageToken = info.next_page_token
      continue
    }

    page += 1

    if (!warnedPastPageLimit && page * MAX_PER_PAGE > PAGE_LIMIT_RECORDS) {
      warnedPastPageLimit = true
      console.warn(
        `[crm] ${label}: past ${PAGE_LIMIT_RECORDS} records on page-number paging. ` +
          `Continuing on more_records; if the API starts rejecting deep pages, this query needs narrowing.`,
      )
    }
  }
}

export async function getAllRecords(module, { fields, ...rest } = {}) {
  const records = await paginate(module, (cursor) =>
    getRecords(module, { fields, ...cursor, ...rest }),
  )
  return { records }
}

/**
 * One page of a criteria search.
 *
 * Zoho answers "no matches" with an empty body rather than an empty list, which
 * the SDK surfaces inconsistently — hence the defensive unwrap.
 */
export async function searchRecords(module, { criteria, fields, per_page = MAX_PER_PAGE, ...cursor } = {}) {
  const res = await withTimeout(
    api().searchRecord({
      Entity: module,
      Type: 'criteria',
      Query: criteria,
      ...(fields ? { fields: fields.join(',') } : {}),
      per_page,
      ...cursor,
    }),
    { ms: 20000, label: `search ${module}` },
  )
  return { records: Array.isArray(res?.data) ? res.data : [], info: res?.info ?? {} }
}

/** Every match for a criteria search, following pagination to exhaustion. */
export async function searchAllRecords(module, { criteria, fields } = {}) {
  const records = await paginate(`search ${module}`, (cursor) =>
    searchRecords(module, { criteria, fields, ...cursor }),
  )
  return { records }
}

/** A single record by id. */
export async function getRecord(module, id) {
  const res = await api().getRecord({ Entity: module, RecordID: id })
  return res?.data?.[0] ?? null
}

/** Field metadata for a module — the source of truth for picklist value mapping. */
export async function getFields(module) {
  const res = await api().getFields({ Entity: module })
  return res?.fields ?? []
}

export async function updateRecord(module, id, payload) {
  return api().updateRecord({ Entity: module, RecordID: id, APIData: payload })
}

export async function insertRecord(module, payload) {
  return api().insertRecord({ Entity: module, APIData: payload })
}
