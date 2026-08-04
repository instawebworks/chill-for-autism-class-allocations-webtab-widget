import { executeFunction } from './api.js'
import { buildSavePayload } from './payload.js'

/**
 * Sending a save to CRM, in as few calls as the argument limit allows.
 *
 * ---------------------------------------------------------------------------
 * Why this is not one call
 * ---------------------------------------------------------------------------
 *
 * Function arguments travel in the query string — a request body arrives empty,
 * verified against the live functions — and the server rejects anything past
 * roughly 3 KB with BODY_SIZE_REACHED. Measured: 2632 bytes accepted, 3144
 * rejected. So a save of any size has to be split.
 *
 * The split is by *encoded size*, not by record count. One class holding twenty
 * students and twenty classes holding one each cost almost the same bytes, so
 * counting records would size chunks by the wrong quantity and still overflow.
 */

export const CLASS_FUNCTION = 'apply_class_allocations'
export const ADMISSION_FUNCTION = 'apply_admission_flags'

/**
 * Bytes of encoded argument to aim for, against a measured ceiling near 3 KB.
 *
 * The headroom is deliberate. The real limit was measured through raw REST,
 * while the widget goes postMessage → CRM host → API, and the host may frame
 * the request slightly differently. Overshooting costs a failed save; a chunk
 * more costs one extra round trip.
 */
export const MAX_ARG_BYTES = 2500

/** Raised when a single class cannot fit in a call, so no split can help. */
export class PayloadTooLargeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PayloadTooLargeError'
  }
}

/** What one payload will cost on the wire, as the argument is actually sent. */
export function encodedSize(payload) {
  return `payload=${encodeURIComponent(JSON.stringify(payload))}`.length
}

/**
 * Split records across as few calls as will fit.
 *
 * A record is never divided. For classes that is a correctness rule rather than
 * a convenience: a subform write replaces the entire roster, so half a class's
 * rows in one call and half in the next would have each call delete the rows the
 * other was carrying. A class that cannot fit alone is an error, not something
 * to break up.
 */
export function chunkBySize(records, wrap, budget = MAX_ARG_BYTES) {
  const chunks = []
  let current = []

  for (const record of records) {
    if (encodedSize(wrap([record])) > budget) {
      throw new PayloadTooLargeError(
        `A single record (${record.id}) exceeds the ${budget}-byte argument limit on its own and cannot be split.`,
      )
    }
    if (current.length > 0 && encodedSize(wrap([...current, record])) > budget) {
      chunks.push(current)
      current = [record]
    } else {
      current.push(record)
    }
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

/** Run one function over pre-sized chunks, gathering every per-record result. */
async function runChunks(fnName, chunks, wrap) {
  const results = []
  let ok = 0
  let failed = 0

  // Sequential, not concurrent. These calls write overlapping records — two
  // classes in different chunks can share an admission — and the functions each
  // consume API credit, so firing them together buys a little latency in
  // exchange for contention and a much harder failure story.
  for (const chunk of chunks) {
    const payload = wrap(chunk)
    const answer = await executeFunction(fnName, { payload: JSON.stringify(payload) })

    if (Array.isArray(answer?.results)) {
      results.push(...answer.results)
      ok += Number(answer.ok) || 0
      failed += Number(answer.failed) || 0
    } else {
      // The function ran but did not answer in its documented shape — treat
      // every record in the chunk as unresolved rather than assume success.
      const reason = answer?.error ?? 'function returned an unreadable result'
      for (const record of chunk) {
        results.push({ id: record.id, status: 'error', message: reason })
      }
      failed += chunk.length
    }
  }

  return { ok, failed, results }
}

const wrapClasses = (classes) => ({ v: 1, classes })
const wrapAdmissions = (admissions) => ({ v: 1, admissions })

/**
 * Apply every pending change.
 *
 * Classes are written before admissions, deliberately. If admissions were
 * flagged first and a class write then failed, a student would be marked placed
 * while sitting in no class, and would have quietly left the waiting queue in
 * every CRM view. The reverse is far softer: the widget derives its waiting list
 * from the rosters themselves, so rosters-without-flags still displays correctly.
 *
 * Nothing is retried here. Both functions are idempotent — the payload is the
 * roster a class should end up with, not a list of changes — so a failed save
 * can simply be sent again, and re-sending the parts that already succeeded
 * changes nothing. That belongs to the caller, which knows whether the user
 * wants to try again.
 *
 * @returns {{ ok: boolean, classes: object, admissions: object, summary: object,
 *             calls: number, failures: object[] }}
 */
export async function applyAllocations({ classes = [], admissions = [], pending = {} } = {}) {
  const payload = buildSavePayload({ classes, admissions, pending })

  const classChunks = chunkBySize(payload.classes, wrapClasses)
  const admissionChunks = chunkBySize(payload.admissions, wrapAdmissions)

  const classResult = await runChunks(CLASS_FUNCTION, classChunks, wrapClasses)

  // Only flag admissions once the rosters they describe are actually in place.
  const admissionResult =
    classResult.failed > 0
      ? { ok: 0, failed: 0, results: [], skipped: true }
      : await runChunks(ADMISSION_FUNCTION, admissionChunks, wrapAdmissions)

  const failures = [...classResult.results, ...admissionResult.results].filter(
    (r) => r.status && r.status !== 'success',
  )

  return {
    ok: failures.length === 0 && !admissionResult.skipped,
    classes: classResult,
    admissions: admissionResult,
    summary: payload.summary,
    calls: classChunks.length + (admissionResult.skipped ? 0 : admissionChunks.length),
    failures,
  }
}
