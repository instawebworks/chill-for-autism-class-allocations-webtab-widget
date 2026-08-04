import { parseRoster } from './allocations.js'

/**
 * The session's unsaved allocation work.
 *
 * Nothing here talks to CRM. The user moves students around for as long as they
 * like, this layer accumulates the result, and only Save turns it into writes.
 *
 * ---------------------------------------------------------------------------
 * Why end-state and not a list of operations
 * ---------------------------------------------------------------------------
 *
 * A pending edit is the *desired roster* for one class, not "remove X" or
 * "add Y". An operation log would grow forever and would report a class as
 * changed after a student was dragged out and dropped back in — so the Save
 * button would light up for a no-op, and Save would fire the Classes workflow
 * on a record whose roster is identical to what CRM already holds.
 *
 * Holding the end state instead means change detection is a comparison against
 * the loaded record, so a round trip back to the original state collapses to
 * "nothing to save" on its own, with no undo stack and no bookkeeping.
 *
 * ---------------------------------------------------------------------------
 * The shape
 * ---------------------------------------------------------------------------
 *
 *   pending = { [classId]: RosterEntry[] }
 *
 * A class absent from the object is untouched and reads through to its loaded
 * roster. Only genuine divergence is stored — see `settle()`, which drops a
 * class again the moment its desired roster matches the baseline. That
 * invariant is what keeps "is anything pending?" honest.
 *
 * ---------------------------------------------------------------------------
 * Rows are entries, not admissions
 * ---------------------------------------------------------------------------
 *
 * An entry is `{ rowId, admissionId }` rather than a bare admission id, because
 * a subform row can legitimately exist with no Admission attached — the Deluge
 * function has an explicit branch for it and keeps such a row, since it still
 * occupies a seat. Keying this layer by admission id would make those rows
 * invisible here, and invisible means omitted from the write, and omitted from
 * a subform write means *deleted*. So they ride along untouched instead.
 */

/** @typedef {{ rowId: string|null, admissionId: string|null }} RosterEntry */

/** The roster as CRM currently holds it, from the class's snapshot. */
export function baselineRoster(cls) {
  return parseRoster(cls).rows.map((row) => ({
    rowId: row.rowId,
    admissionId: row.admissionId,
  }))
}

/** The roster as the user has left it: the pending edit, or the baseline. */
export function desiredRoster(cls, pending = {}) {
  return pending?.[cls?.id] ?? baselineRoster(cls)
}

/**
 * Identity of an entry for comparison.
 *
 * Both halves matter. `rowId` alone cannot identify a row the user has just
 * added (CRM has not assigned one yet), and `admissionId` alone cannot tell two
 * Admission-less rows apart.
 */
function entryKey(entry) {
  return `${entry?.rowId ?? ''}::${entry?.admissionId ?? ''}`
}

/**
 * Do two rosters hold the same rows?
 *
 * Order-insensitive on purpose: the subform has no meaningful row order, so
 * treating a reshuffle as a change would enable Save for a write that alters
 * nothing.
 */
export function sameRoster(a = [], b = []) {
  if (a.length !== b.length) return false
  const ka = a.map(entryKey).sort()
  const kb = b.map(entryKey).sort()
  return ka.every((key, i) => key === kb[i])
}

/**
 * Record a new desired roster for a class, keeping the "divergence only"
 * invariant. Returns a new object — never mutates, so it is safe as React state.
 */
function settle(pending, cls, next) {
  const out = { ...pending }
  if (sameRoster(baselineRoster(cls), next)) {
    delete out[cls.id]
  } else {
    out[cls.id] = next
  }
  return out
}

/**
 * Place an admission in a class. A no-op if it is already there.
 *
 * If the loaded roster already had a row for this admission — the user took
 * them out earlier in the session and has now put them back — that row's id is
 * restored rather than a fresh row being created.
 *
 * This is not tidiness. Without it the entry carries `rowId: null`, which
 * differs from the baseline entry, so the class reports as changed even though
 * it holds exactly what CRM holds, and Save lights up for a no-op. Worse, the
 * write would then delete the original row and create a replacement, moving the
 * row id and discarding its history for no reason.
 */
export function withAdmission(pending, cls, admissionId) {
  if (!cls || !admissionId) return pending
  const current = desiredRoster(cls, pending)
  if (current.some((e) => e.admissionId === admissionId)) return pending

  // Null when this is genuinely new: CRM assigns the id when the row is created.
  const priorRowId = baselineRoster(cls).find((e) => e.admissionId === admissionId)?.rowId ?? null
  return settle(pending, cls, [...current, { rowId: priorRowId, admissionId }])
}

/** Take an admission out of a class. A no-op if it was not in it. */
export function withoutAdmission(pending, cls, admissionId) {
  if (!cls || !admissionId) return pending
  const current = desiredRoster(cls, pending)
  const next = current.filter((e) => e.admissionId !== admissionId)
  if (next.length === current.length) return pending
  return settle(pending, cls, next)
}

/** Drop every pending edit for one class, restoring its loaded roster. */
export function withClassReset(pending, classId) {
  if (!pending?.[classId]) return pending
  const out = { ...pending }
  delete out[classId]
  return out
}

/**
 * Classes whose desired roster differs from the loaded one.
 *
 * Computed structurally rather than read off the keys of `pending`. The
 * invariant means the two agree, but this is the definition the Save button
 * should answer to, and it stays correct if a caller ever builds a pending
 * object by hand. At a few dozen classes the cost is irrelevant.
 */
export function changedClasses(classes = [], pending = {}) {
  return classes.filter((cls) => !sameRoster(baselineRoster(cls), desiredRoster(cls, pending)))
}

/** Is there anything to save? */
export function hasPendingChanges(classes = [], pending = {}) {
  return changedClasses(classes, pending).length > 0
}

/**
 * Every admission that sits in some class once pending changes are applied.
 *
 * This drives the `Allocated` flag, and therefore the waiting panel. It is a
 * union across classes rather than a per-class answer, so a student moved from
 * one class to another is never briefly reported as unplaced.
 *
 * Pass the full term-scoped class list, not the location-filtered one — an
 * admission allocated in a class outside the current view is still allocated,
 * and judging it against a filtered list would wrongly mark it free.
 */
export function projectedAllocatedIds(classes = [], pending = {}) {
  const ids = new Set()
  for (const cls of classes) {
    for (const entry of desiredRoster(cls, pending)) {
      if (entry.admissionId) ids.add(entry.admissionId)
    }
  }
  return ids
}
