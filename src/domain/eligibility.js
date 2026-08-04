import { capacityOf, lookupName } from './classes.js'
import { programLabel } from './schedule.js'

/**
 * Whether an admission may be placed in a class.
 *
 * One pure function, consulted from three places that must never disagree: the
 * pill while a card is dragged over it, the dialog's drop zone, and the drop
 * itself. If any of them applied its own version of the rule, the board would
 * invite a drop it then refuses — the worst of both.
 *
 * The verdict carries its own wording. A refusal that only says "not allowed"
 * makes the user guess which of several rules they broke, and the message is
 * part of the rule rather than decoration for it.
 */

/** Programme names are free-text picklists; compare them forgivingly. */
function normaliseProgram(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * @param {object}   input
 * @param {object}   input.cls        the target class
 * @param {object}   input.admission  the admission being placed
 * @param {Array}    input.roster     the class's roster *including* pending edits
 * @returns {{ ok: boolean, code: string, tone?: 'info'|'warn'|'danger',
 *             title?: string, detail?: string }}
 */
export function evaluateAllocation({ cls, admission, roster = [] }) {
  if (!cls || !admission) {
    return {
      ok: false,
      code: 'unknown',
      tone: 'danger',
      title: 'Could not allocate',
      detail: 'The class or the admission could not be identified.',
    }
  }

  const student = lookupName(admission.Student_Name) ?? 'This student'
  const classLabel = programLabel(cls.Program)

  // Not an error — the pending layer would refuse the duplicate anyway. It is
  // reported so a drop that does nothing does not look like a fault.
  if (roster.some((entry) => entry.admissionId === admission.id)) {
    return {
      ok: false,
      code: 'already-allocated',
      tone: 'info',
      title: 'Already in this class',
      detail: `${student} is already allocated to ${classLabel} on ${cls.Class_Day}.`,
    }
  }

  // Checked before capacity: if both fail, the wrong programme is the more
  // useful thing to be told, because freeing a seat would not help.
  const wanted = normaliseProgram(cls.Program)
  const held = normaliseProgram(admission.Program_Name)
  if (wanted && held && wanted !== held) {
    return {
      ok: false,
      code: 'wrong-program',
      tone: 'danger',
      title: 'Wrong programme',
      detail: `${admission.Name} is a ${admission.Program_Name} admission, so it cannot go into a ${cls.Program} class.`,
    }
  }

  // A missing capacity is treated as unknown rather than as zero — the same
  // convention isFull() uses — so a class whose seats have never been set stays
  // usable instead of silently refusing everyone.
  const capacity = capacityOf(cls)
  if (capacity > 0 && roster.length >= capacity) {
    return {
      ok: false,
      code: 'class-full',
      tone: 'warn',
      title: 'Class is full',
      detail: `${classLabel} on ${cls.Class_Day} has all ${capacity} seat${capacity === 1 ? '' : 's'} taken.`,
    }
  }

  return { ok: true, code: 'ok' }
}
