import { formatSlot, parseSlot, startMinutes } from './schedule.js'
import { programKey } from './programs.js'

/**
 * The sessions a family actually enrolled in, from the Enrollment's
 * Selected_Programs_Data_JSON.
 *
 * ---------------------------------------------------------------------------
 * Why this exists, and what it replaced
 * ---------------------------------------------------------------------------
 *
 * The waiting-list card used to show the first line of `Session_Preference_Order`.
 * That field is the enrolment form's ranked wish list and it lives on the
 * ENROLMENT — one list, shared by every Admission the enrolment produced. A
 * family taking Plus and Mindfulness therefore saw the same day and time on both
 * cards, because both were reading line one of the same list. Measured against
 * live Term 4 data, 57 of 148 admissions displayed a session that was not the
 * one they were enrolled and invoiced for.
 *
 * The Selected Programs List is the right source: it is per programme, it is
 * what the invoice and service agreement are built from, and it is a commitment
 * rather than a preference. `Selected_Programs_Data_JSON` is a snapshot of that
 * subform published into a text field — the same trick `Allocation_Data_JSON`
 * uses on Classes, and for the same reason: subform rows never come back from
 * getRecords, so the snapshot is the only way to read them in bulk.
 *
 * ---------------------------------------------------------------------------
 * Shape
 * ---------------------------------------------------------------------------
 *
 *   [ { "program_id":    "31531000000062020",
 *       "program_name":  "Chill Mindfulness",
 *       "session_time":  "Mondays 2:00pm - 4:15pm",
 *       "support_level": "$2,317.77 (standard support)" } ]
 *
 * A bare array, NOT the `{v, count, rows}` envelope the class roster uses. There
 * is no version marker to read, so nothing here may assume one.
 *
 * Matching is by `program_name` through `programKey`, never by `program_id`:
 * the id is an empty string on every "Chill Plus" row in the live data, so it
 * cannot be relied on to identify anything.
 *
 * Everything is defensive. The field is plain text written by an external
 * process and can be null, truncated, hand-edited, or newer than this build.
 * None of that may throw during render.
 */

/**
 * @typedef {{
 *   programName: string|null, key: string, sessionTime: string|null,
 *   day: string|null, start: number|null, supportLevel: string|null,
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
  const sessionTime = str(row?.session_time)
  const slot = sessionTime ? parseSlot(sessionTime) : null

  return {
    programName: str(row?.program_name),
    key: programKey(row?.program_name),
    sessionTime,
    day: slot?.day ?? null,
    start: slot?.start ?? null,
    supportLevel: str(row?.support_level),
  }
}

/** Parse one Enrollment's selected-programmes snapshot. Never throws. */
export function parseSelectedPrograms(enrollment) {
  const raw = enrollment?.Selected_Programs_Data_JSON

  if (raw == null || String(raw).trim() === '') {
    return { status: 'missing', rows: [] }
  }

  let data
  try {
    data = JSON.parse(raw)
  } catch {
    console.warn(
      `[selected-programs] ${enrollment?.Name ?? enrollment?.id}: Selected_Programs_Data_JSON is not valid JSON.`,
    )
    return { status: 'invalid', rows: [] }
  }

  if (!Array.isArray(data)) {
    console.warn(
      `[selected-programs] ${enrollment?.Name ?? enrollment?.id}: Selected_Programs_Data_JSON is not an array.`,
    )
    return { status: 'invalid', rows: [] }
  }

  // A row with no programme name cannot be matched to an admission, so it is
  // dropped rather than kept as an entry nothing can ever look up.
  const rows = data.map(normaliseRow).filter((r) => r.key !== '')

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
 * The session behind one admission, via its Enrollment lookup and programme.
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
