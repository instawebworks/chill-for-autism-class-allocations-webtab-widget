/**
 * The allocation roster, read from the Class record's Allocation_Data_JSON.
 *
 * Subform rows never come back from getRecords/getAllRecords — only
 * getRecordById returns them, and fetching ~50 classes one at a time is not
 * worth 50 round trips. So the Classes workflow publishes a snapshot of the
 * subform into a text field, and the widget reads that instead. Zero extra
 * calls; the roster arrives with the class.
 *
 * Everything here is defensive. The field is plain text written by an external
 * process: it can be null on a record the workflow has not touched, truncated,
 * hand-edited, or written by a newer version of the function than this build
 * knows about. None of those may throw during render.
 */

export const ROSTER_VERSION = 1

/**
 * @typedef {{
 *   rowId: string|null, admissionId: string|null, admissionNo: string|null,
 *   studentId: string|null, studentName: string|null, enrolmentNo: string|null,
 * }} RosterRow
 *
 * status:
 *   'ok'      rows present
 *   'empty'   valid snapshot, nobody allocated
 *   'missing' field never written — the workflow has not run on this class
 *   'invalid' unparseable or wrong shape
 *
 * 'missing' and 'empty' are deliberately different. Both show zero students,
 * but 'empty' is a fact and 'missing' is an absence of information — only the
 * first justifies telling someone the class has no one in it.
 */

function str(value) {
  const s = String(value ?? '').trim()
  return s === '' ? null : s
}

function normaliseRow(row) {
  return {
    rowId: str(row?.rowId),
    admissionId: str(row?.admissionId),
    admissionNo: str(row?.admissionNo),
    studentId: str(row?.studentId),
    studentName: str(row?.studentName),
    enrolmentNo: str(row?.enrolmentNo),
  }
}

/** Parse one Class record's roster snapshot. Never throws. */
export function parseRoster(cls) {
  const raw = cls?.Allocation_Data_JSON

  if (raw == null || String(raw).trim() === '') {
    return { status: 'missing', rows: [], declaredCount: null, version: null }
  }

  let data
  try {
    data = JSON.parse(raw)
  } catch {
    console.warn(`[roster] ${cls?.Name ?? cls?.id}: Allocation_Data_JSON is not valid JSON.`)
    return { status: 'invalid', rows: [], declaredCount: null, version: null }
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.rows)) {
    console.warn(`[roster] ${cls?.Name ?? cls?.id}: Allocation_Data_JSON has no rows array.`)
    return { status: 'invalid', rows: [], declaredCount: null, version: null }
  }

  const version = Number(data.v) || null
  const rows = data.rows.map(normaliseRow)
  const declaredCount = Number.isFinite(Number(data.count)) ? Number(data.count) : null

  // A newer writer is tolerated rather than rejected: unknown keys are ignored
  // and the known ones still read correctly, so a schema bump does not blank the
  // board until the widget is redeployed.
  if (version && version > ROSTER_VERSION) {
    console.info(
      `[roster] ${cls?.Name ?? cls?.id}: snapshot v${version} is newer than v${ROSTER_VERSION}; reading known fields only.`,
    )
  }

  // The count is written by the same pass that wrote the rows, so a mismatch
  // means the snapshot was truncated or hand-edited — worth surfacing, but the
  // rows themselves are still the better answer.
  if (declaredCount != null && declaredCount !== rows.length) {
    console.warn(
      `[roster] ${cls?.Name ?? cls?.id}: count says ${declaredCount} but ${rows.length} rows are present.`,
    )
  }

  return {
    status: rows.length > 0 ? 'ok' : 'empty',
    rows,
    declaredCount,
    version,
  }
}

/** Just the rows. Empty array for missing/invalid snapshots. */
export function rosterOf(cls) {
  return parseRoster(cls).rows
}

/** Is this admission already placed in this class? */
export function rosterHasAdmission(cls, admissionId) {
  if (!admissionId) return false
  return rosterOf(cls).some((row) => row.admissionId === admissionId)
}
