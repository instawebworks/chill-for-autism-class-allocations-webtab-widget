import { formatSlot, parseSlot, startMinutes } from './schedule.js'
import { programKey } from './programs.js'

/**
 * The sessions a family actually enrolled in, from the Enrollment's
 * Enrolled_Sessions_JSON.
 *
 * ---------------------------------------------------------------------------
 * Why this exists, and what it replaced
 * ---------------------------------------------------------------------------
 *
 * The waiting-list card used to show the first line of `Session_Preference_Order`.
 * That field is the enrolment form's ranked wish list and it lives on the
 * ENROLMENT — one list, shared by every Admission the enrolment produced. A
 * family taking Plus and Mindfulness therefore saw the same day and time on both
 * cards, because both were reading line one of the same list.
 *
 * The Selected Programs List is the right source: it is per programme, it is
 * what the invoice and service agreement are built from, and it is a commitment
 * rather than a preference. It is also the list the client reads in CRM and
 * checks this widget against, which makes it the definition of correct:
 *
 *   the session on a card must equal the Session Time to Enroll on that
 *   admission's row of the enrolment's Selected Programs List.
 *
 * ---------------------------------------------------------------------------
 * Why a snapshot field, and why NOT Selected_Programs_Data_JSON
 * ---------------------------------------------------------------------------
 *
 * Subform rows never come back from getRecords, so they cannot be read in bulk;
 * the Enrollments workflow publishes a snapshot into a text field instead. Same
 * trick Allocation_Data_JSON uses on Classes, same reason. The publisher is
 * version-controlled at deluge/build_Enrolled_Sessions_JSON.dg and mirrors the
 * subform verbatim.
 *
 * `Selected_Programs_Data_JSON` is a different field that looks like this one
 * and must not be used. It is written by another process and does not mirror
 * the subform: its core-programme row (Plus / Foundation) carries the enrolment
 * form's preference line rather than the selected session, and it is never
 * rebuilt when the subform is corrected. Audited on Term 4 2026 — of its 111
 * rows with a blank program_id, 105 are character-identical to
 * Session_Preference_Order line 1 and 110 carry that list's "12.45pm" dot
 * formatting, while none of the 77 rows with a real program_id do either. It is
 * left in place untouched for whatever else reads it.
 *
 * ---------------------------------------------------------------------------
 * Shape
 * ---------------------------------------------------------------------------
 *
 *   { "v": 1, "count": 1, "rows": [
 *       { "rowId":        "125966000002409066",
 *         "admissionNo":  "ADM-00097",
 *         "programName":  "Chill Plus",
 *         "sessionTime":  "Tuesdays 10:00am - 12:30pm",
 *         "supportLevel": "$2,648.88 (standard support)" } ] }
 *
 * `admissionNo` is the subform's "Admission ID" column — note that its CRM API
 * name is `Session_Date_Time`, a rename that kept its original API name. The
 * Deluge function deals with that; nothing here needs to know.
 *
 * Everything is defensive. The field is plain text written by an external
 * process and can be null, truncated, hand-edited, or newer than this build.
 * None of that may throw during render.
 *
 * Export names are unchanged from the version that read the old field, so the
 * two components consuming this module did not have to be touched.
 */

export const SESSIONS_VERSION = 1

/**
 * @typedef {{
 *   rowId: string|null, admissionNo: string|null, programName: string|null,
 *   key: string, sessionTime: string|null, day: string|null,
 *   start: number|null, supportLevel: string|null,
 * }} EnrolledSession
 *
 * status:
 *   'ok'      rows present
 *   'empty'   valid snapshot, no programmes listed
 *   'missing' field never written
 *   'invalid' unparseable or wrong shape
 *
 * 'missing' and 'empty' are kept apart for the same reason the class roster
 * keeps them apart: one is an absence of information, the other is a fact.
 */

function str(value) {
  const s = String(value ?? '').trim()
  return s === '' ? null : s
}

function normaliseRow(row) {
  const sessionTime = str(row?.sessionTime)
  const slot = sessionTime ? parseSlot(sessionTime) : null

  return {
    rowId: str(row?.rowId),
    admissionNo: str(row?.admissionNo),
    programName: str(row?.programName),
    key: programKey(row?.programName),
    sessionTime,
    day: slot?.day ?? null,
    start: slot?.start ?? null,
    supportLevel: str(row?.supportLevel),
  }
}

/** Parse one Enrollment's session snapshot. Never throws. */
export function parseSelectedPrograms(enrollment) {
  const raw = enrollment?.Enrolled_Sessions_JSON
  const label = enrollment?.Name ?? enrollment?.id

  if (raw == null || String(raw).trim() === '') {
    return { status: 'missing', rows: [] }
  }

  let data
  try {
    data = JSON.parse(raw)
  } catch {
    console.warn(`[sessions] ${label}: Enrolled_Sessions_JSON is not valid JSON.`)
    return { status: 'invalid', rows: [] }
  }

  // A bare array is tolerated as well as the envelope. It costs two lines and
  // means a snapshot written by an older or hand-rolled pass still reads,
  // rather than blanking every card on the board.
  const list = Array.isArray(data) ? data : data?.rows
  if (!Array.isArray(list)) {
    console.warn(`[sessions] ${label}: Enrolled_Sessions_JSON has no rows array.`)
    return { status: 'invalid', rows: [] }
  }

  const version = Number(data?.v) || null
  if (version && version > SESSIONS_VERSION) {
    // Tolerated rather than rejected: unknown keys are ignored and the known
    // ones still read, so a schema bump does not blank the board until the
    // widget is redeployed.
    console.info(
      `[sessions] ${label}: snapshot v${version} is newer than v${SESSIONS_VERSION}; reading known fields only.`,
    )
  }

  const declaredCount = Number.isFinite(Number(data?.count)) ? Number(data.count) : null
  if (declaredCount != null && declaredCount !== list.length) {
    // Written by the same pass that wrote the rows, so a mismatch means the
    // snapshot was truncated or hand-edited. The rows are still the better
    // answer, so this is reported rather than acted on.
    console.warn(
      `[sessions] ${label}: count says ${declaredCount} but ${list.length} rows are present.`,
    )
  }

  // A row with neither an admission number nor a readable programme name can
  // never be matched to a card, so it is dropped rather than kept as an entry
  // nothing will ever look up. The snapshot deliberately keeps such rows — the
  // count has to agree with the subform — but they are of no use here.
  const rows = list.map(normaliseRow).filter((r) => r.admissionNo != null || r.key !== '')

  return { status: rows.length > 0 ? 'ok' : 'empty', rows }
}

/** Parsed rows for every enrolment that has any, keyed by record id. */
export function selectedProgramsByEnrollment(enrollments = []) {
  const map = new Map()
  for (const enr of enrollments) {
    const { rows } = parseSelectedPrograms(enr)
    if (rows.length > 0) map.set(enr.id, rows)
  }
  return map
}

/**
 * The session behind one admission, via its Enrollment lookup.
 *
 * Matched on the admission number first, because the subform carries it and it
 * is an exact identity — ADM-00097 is that admission and no other. That is
 * strictly better than the programme-name match it replaced, which had to
 * survive three separate spelling conventions between the two modules (see
 * programKey) and could only ever be as good as those rules.
 *
 * The programme-name match is kept as a fallback for rows whose Admission ID
 * column was never filled in, which is the state every row predating that
 * column is in.
 *
 * Null when the admission has no enrolment link, the enrolment listed no
 * programmes, or — and this one is real in the live data — the admission is for
 * a programme that does not appear on its enrolment's list at all. All three
 * mean the same thing to a caller: there is nothing to show. Callers must show
 * nothing rather than falling back to the preference list, which is the exact
 * misleading label this module exists to remove.
 */
export function enrolledSessionFor(admission, byEnrollment) {
  const id = admission?.Enrollment?.id
  if (!id) return null

  const rows = byEnrollment?.get(id)
  if (!rows) return null

  const admissionNo = str(admission?.Name)
  if (admissionNo) {
    const exact = rows.find((row) => row.admissionNo === admissionNo)
    if (exact) return exact
  }

  const want = programKey(admission?.Program_Name)
  if (!want) return null

  return rows.find((row) => row.key === want) ?? null
}

/**
 * "Mon 2pm" — the enrolled session at card size, falling back to the raw text
 * when it could not be parsed. Shares the preference list's formatter so the
 * same time of day never renders two different ways.
 */
export function shortSession(session) {
  if (!session) return null
  return formatSlot({ raw: session.sessionTime ?? '', day: session.day, start: session.start })
}

/**
 * Is this class the session the family enrolled in?
 *
 * Day plus start minute, the same comparison the preference matcher used — a
 * session time is not compared as text, because the two sides are written by
 * different parts of the form. A session whose text could not be parsed matches
 * nothing, rather than matching everything.
 */
export function sessionMatchesClass(session, cls) {
  if (!session || session.day == null || session.start == null) return false
  if (session.day !== cls?.Class_Day) return false
  return startMinutes(cls?.Class_Time) === session.start
}
