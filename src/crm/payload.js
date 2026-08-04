import { parseRoster } from '../domain/allocations.js'
import {
  baselineRoster,
  changedClasses,
  desiredRoster,
  projectedAllocatedIds,
} from '../domain/pending.js'

/**
 * Turning pending changes into the arguments the CRM functions expect.
 *
 * Pure: no SDK, no network, no clock. Give it the loaded records and the
 * session's pending edits and it returns exactly what would be sent. That makes
 * the interesting question — "what is about to happen to my data?" — answerable
 * without touching CRM, which matters for a write that replaces whole subforms.
 *
 * ---------------------------------------------------------------------------
 * Why this is not the shape of a CRM record
 * ---------------------------------------------------------------------------
 *
 * The writes go through two Deluge functions rather than straight at the REST
 * API, so the payload is their argument shape and not a Classes record:
 *
 *   { id, rows: [ { rowId?, admissionId } ] }
 *
 * `Allocation_Data_JSON` and `Seats_Allocated` are deliberately absent even
 * though the widget could compute both. They are derivable from the rows, and
 * the function derives them by rerunning the same routine the Classes workflow
 * uses — so sending them would duplicate work and, worse, create a second
 * definition of what a class record should look like. It also keeps the payload
 * roughly ten times smaller, which is not cosmetic: the argument ceiling is
 * about 3 KB, so size is the binding constraint on how much can be saved at
 * once. See crm/save.js.
 *
 * ---------------------------------------------------------------------------
 * What one save touches
 * ---------------------------------------------------------------------------
 *
 * Only records that actually changed. A class the user opened, looked at and
 * left alone produces nothing, because every write reruns the derivation and a
 * no-op write is a real cost paid for nothing.
 */

/**
 * The rows a class should END UP with.
 *
 * Both ids are optional and mean different things to the function:
 *   rowId present  → that subform row is kept and updated in place
 *   rowId absent   → a new row is created
 *   row omitted    → DELETED, because a subform write replaces the whole set
 *
 * A row with no admissionId is still emitted when it has a rowId. Those exist —
 * the Deluge workflow has an explicit branch for a roster row with no Admission
 * attached — and dropping it here would silently delete it.
 */
function rowsFor(desired) {
  return desired.map((entry) => {
    const row = {}
    if (entry.rowId) row.rowId = entry.rowId
    if (entry.admissionId) row.admissionId = entry.admissionId
    return row
  })
}

/**
 * Build the arguments for one save.
 *
 * @param {object}   input
 * @param {object[]} input.classes    Loaded classes for the term. Pass the full
 *                                    term list, not the location-filtered one —
 *                                    see projectedAllocatedIds.
 * @param {object[]} input.admissions Loaded admissions for the term.
 * @param {object}   input.pending    The pending map from domain/pending.js.
 *
 * @returns {{
 *   classes: {id: string, rows: object[]}[],
 *   admissions: {id: string, allocated: boolean}[],
 *   summary: { classCount: number, admissionCount: number,
 *              newRowCount: number, removedRowCount: number },
 * }}
 */
export function buildSavePayload({ classes = [], admissions = [], pending = {} } = {}) {
  const touched = changedClasses(classes, pending)

  let newRowCount = 0
  let removedRowCount = 0

  const classPayloads = touched.map((cls) => {
    const desired = desiredRoster(cls, pending)
    const priorRows = parseRoster(cls).rows

    const survivingIds = new Set(desired.map((e) => e.rowId).filter(Boolean))
    removedRowCount += priorRows.filter((r) => r.rowId && !survivingIds.has(r.rowId)).length
    newRowCount += desired.filter((e) => !e.rowId).length

    return { id: cls.id, rows: rowsFor(desired) }
  })

  // Only admissions this save actually moves are considered — those in the
  // before or after roster of a changed class.
  //
  // The wider "fix every admission whose flag disagrees with the rosters" is
  // tempting and wrong. CRM already contains such disagreements, and repairing
  // those as a side effect of an unrelated save would write records the user
  // never touched and quietly erase the evidence of a real data problem.
  const affected = new Set()
  for (const cls of touched) {
    for (const entry of baselineRoster(cls)) {
      if (entry.admissionId) affected.add(entry.admissionId)
    }
    for (const entry of desiredRoster(cls, pending)) {
      if (entry.admissionId) affected.add(entry.admissionId)
    }
  }

  // Judged against the projection across every class, so a student moved
  // between two classes is never written as unplaced in between.
  const allocated = projectedAllocatedIds(classes, pending)
  const admissionPayloads = []
  for (const adm of admissions) {
    if (!affected.has(adm.id)) continue
    const shouldBe = allocated.has(adm.id)
    // Compared against `true` rather than negated: the field reads null on
    // records created before it existed, and null is not "definitely placed".
    if (shouldBe !== (adm.Allocated === true)) {
      admissionPayloads.push({ id: adm.id, allocated: shouldBe })
    }
  }

  return {
    classes: classPayloads,
    admissions: admissionPayloads,
    summary: {
      classCount: classPayloads.length,
      admissionCount: admissionPayloads.length,
      newRowCount,
      removedRowCount,
    },
  }
}
