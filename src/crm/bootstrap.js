import { getAllRecords } from './api.js'
import { fetchByTerm } from './fetchByTerm.js'
import { fetchTerms, resolveTargetTerm } from '../creator/terms.js'
import {
  admissionInTerm,
  admissionTermCriteria,
  classInTerm,
  classTermCriteria,
  enrollmentInTerm,
  enrollmentTermCriteria,
} from '../domain/termMatch.js'

const LOCATION_FIELDS = [
  'Name',
  'Location_Code',
  'Address_City',
  'Address_State_Province',
  'Address_Street_Address',
]

// NOTE: `Loction` is genuinely misspelled in the CRM schema. Do not "fix" it.
// NOTE: `Allocated_Seats` is capacity and `Seats_Allocated` is occupancy — the
// names read backwards. Always go through domain/classes.js accessors.
const CLASS_FIELDS = [
  'Name',
  'Program',
  'Select_Term',
  'Academic_Year',
  'Class_Day',
  'Class_Time',
  'Class_Type',
  'Class_Date',
  'Term_Dates',
  'Classroom',
  'Loction',
  'Facilitator',
  'Seats_Allocated',
  'Allocated_Seats',
  'Class_Active',
  // Per-programme pill colour, held on the record so the palette is editable in
  // CRM without a deploy. Absent until the field exists; the board falls back to
  // a neutral fill.
  'Class_Color_Code',
  // Snapshot of the Students Allocated subform, published by the Classes
  // workflow. The only way to read allocations in bulk — subforms never come
  // back from getRecords. See domain/allocations.js.
  'Allocation_Data_JSON',
]

// Only what the preference display needs. The module carries a lot more
// (signatures, NDIS goals, consents) that the widget has no business reading.
const ENROLLMENT_FIELDS = ['Name', 'Session_Preference_Order', 'Term']

const ADMISSION_FIELDS = [
  'Name',
  'Student_Name',
  'Enrollment',
  'Location_Name',
  'Program_Name',
  'Term',
  'Academic_Year',
  'Allocated',
  'Student_s_Age',
  'Contact_Name',
  'Contact_Email',
]

/**
 * Startup data loading, in stages.
 *
 * Stages run in order; tasks inside a stage run concurrently. This shape exists
 * because later fetches depend on earlier results — nothing after stage 1 can be
 * requested until the target term is known, so a flat concurrent run would have
 * to guess. Each task receives the accumulated context, so a stage-2 task can
 * read `ctx.targetTerm` directly.
 *
 * A task is either:
 *   { key, label, hint, run: async (ctx) => any }   — arbitrary source
 *   { key, label, hint, module, fields: [...] }     — a CRM module
 *
 * `derive` runs once a stage's tasks have all succeeded, and folds computed
 * values into the context for later stages. Derived values are not fetches, so
 * they get no progress row.
 *
 * If any task in a stage fails, later stages are skipped: they would be built on
 * data we know is missing, and a timetable quietly scoped to the wrong term is
 * worse than one that refuses to open.
 */
export const BOOTSTRAP_STAGES = [
  {
    name: 'Term',
    tasks: [
      {
        key: 'terms',
        label: 'Terms',
        hint: 'Term dates from Creator',
        run: () => fetchTerms(),
      },
    ],
    derive: (ctx, { selectedTermId } = {}) => {
      const { term, basis } = resolveTargetTerm(ctx.terms, { selectedId: selectedTermId })
      if (!term) throw new Error('No terms returned — cannot determine the target term.')
      console.info(`[bootstrap] target term: ${term.label} (${basis})`)
      return { targetTerm: term, targetTermBasis: basis }
    },
  },
  {
    name: 'Term data',
    tasks: [
      {
        key: 'locations',
        label: 'Locations',
        hint: 'Sites and campuses',
        // Unfiltered and unpaginated by intent: the org runs a handful of sites
        // (one today), so there is nothing to narrow and no second page to walk.
        run: async () => {
          const { records } = await getAllRecords('Locations', { fields: LOCATION_FIELDS })
          return records
        },
      },
      {
        key: 'classes',
        label: 'Classes',
        hint: 'Sessions in the target term',
        run: (ctx) =>
          fetchByTerm('Classes', {
            criteria: classTermCriteria(ctx.targetTerm),
            fields: CLASS_FIELDS,
            matcher: (c) => classInTerm(c, ctx.targetTerm),
          }),
      },
      {
        key: 'admissions',
        label: 'Admissions',
        hint: 'Students to place this term',
        run: (ctx) =>
          fetchByTerm('Admissions', {
            criteria: admissionTermCriteria(ctx.targetTerm),
            fields: ADMISSION_FIELDS,
            matcher: (a) => admissionInTerm(a, ctx.targetTerm),
          }),
      },
      {
        key: 'enrollments',
        label: 'Preferences',
        hint: 'Session preferences from enrolments',
        // Non-fatal by design, unlike every other task. Preferences are a hint
        // for the person allocating, and a hint must never take the timetable
        // down with it — a failed fetch degrades to "no preferences shown",
        // logged so the absence is diagnosable rather than silent.
        run: async (ctx) => {
          try {
            return await fetchByTerm('Enrollments', {
              criteria: enrollmentTermCriteria(ctx.targetTerm),
              fields: ENROLLMENT_FIELDS,
              matcher: (e) => enrollmentInTerm(e, ctx.targetTerm),
            })
          } catch (err) {
            console.warn('[bootstrap] enrollments failed — preferences will not be shown.', err)
            return []
          }
        },
      },
    ],
  },
]

/** Flat task list, for progress rows and their ordering. */
export const BOOTSTRAP_TASKS = BOOTSTRAP_STAGES.flatMap((s) => s.tasks)

async function runTask(task, ctx) {
  if (task.run) return task.run(ctx)
  const { records } = await getAllRecords(task.module, { fields: task.fields })
  return records
}

function sizeOf(value) {
  return Array.isArray(value) ? value.length : value == null ? 0 : 1
}

/**
 * Runs the stages in order, reporting each task transition.
 *
 * `options` is handed to every stage's `derive`, which is how a caller steers the
 * run without the stages having to reach out for state. Today that is the term
 * the user picked in the header: the whole bootstrap is re-run on a term switch,
 * because everything after stage 1 is fetched with term criteria and none of it
 * can be re-scoped client-side the way location can.
 *
 * @param {(key: string, state: object) => void} onProgress
 * @param {{ selectedTermId?: string|null }} [options]
 * @returns {Promise<{data: object, errors: object}>}
 */
export async function runBootstrap(onProgress = () => {}, options = {}) {
  const ctx = {}
  const errors = {}

  for (const [index, stage] of BOOTSTRAP_STAGES.entries()) {
    await Promise.all(
      stage.tasks.map(async (task) => {
        onProgress(task.key, { status: 'loading' })
        try {
          const value = await runTask(task, ctx)
          ctx[task.key] = value
          onProgress(task.key, { status: 'done', count: sizeOf(value) })
        } catch (err) {
          const message = String(err?.message ?? err)
          errors[task.key] = message
          ctx[task.key] = Array.isArray(ctx[task.key]) ? ctx[task.key] : []
          onProgress(task.key, { status: 'error', error: message })
          console.error(`[bootstrap] ${task.key} failed:`, err)
        }
      }),
    )

    const stageFailed = stage.tasks.some((t) => errors[t.key])

    if (!stageFailed && stage.derive) {
      try {
        Object.assign(ctx, stage.derive(ctx, options))
      } catch (err) {
        errors[`${stage.name}:derive`] = String(err?.message ?? err)
        console.error(`[bootstrap] ${stage.name} derive failed:`, err)
      }
    }

    if (Object.keys(errors).length > 0) {
      // Mark everything downstream as skipped rather than leaving it spinning.
      BOOTSTRAP_STAGES.slice(index + 1)
        .flatMap((s) => s.tasks)
        .forEach((t) => onProgress(t.key, { status: 'skipped' }))
      break
    }
  }

  return { data: ctx, errors }
}
