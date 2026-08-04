import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useData } from '../crm/DataProvider.jsx'
import { buildSavePayload } from '../crm/payload.js'
import { applyAllocations } from '../crm/save.js'
import { useNotice } from './Notice.jsx'
import { priorRowsByRowId, resolveRosterRow } from '../domain/allocations.js'
import {
  desiredRoster,
  hasPendingChanges,
  projectedAllocatedIds,
  withAdmission,
  withClassReset,
  withoutAdmission,
} from '../domain/pending.js'

const AllocationsContext = createContext(null)

/**
 * The session's unsaved allocation work, held for the whole widget.
 *
 * Nothing here writes to CRM. Edits accumulate in memory for as long as the
 * user wants, and Save is the only moment anything leaves the browser.
 *
 * Deliberately reads from `useData()` — the full term-scoped records — and not
 * from the workspace's location-filtered view. An admission allocated in a
 * class at another site is still allocated, and judging that against a filtered
 * list would report it as free and write `Allocated: false` over a real
 * placement. Location is a lens on the display, never on the truth.
 */
export function AllocationsProvider({ children }) {
  const { classes, admissions, reload } = useData()
  const { notify } = useNotice()
  const [pending, setPending] = useState({})
  const [saving, setSaving] = useState(false)

  const allocate = useCallback((cls, admissionId) => {
    setPending((p) => withAdmission(p, cls, admissionId))
  }, [])

  const deallocate = useCallback((cls, admissionId) => {
    setPending((p) => withoutAdmission(p, cls, admissionId))
  }, [])

  const resetClass = useCallback((classId) => {
    setPending((p) => withClassReset(p, classId))
  }, [])

  const discardAll = useCallback(() => setPending({}), [])

  /**
   * Write every pending change, and tell the user what happened.
   *
   * On success the data set is reloaded rather than the pending edits simply
   * being dropped. Clearing them alone would snap the board back to the rosters
   * loaded at startup — which no longer match CRM — so the save would appear to
   * undo itself. The reload unmounts this provider, which discards `pending`
   * as a side effect; that is correct, because it has just been applied.
   *
   * On any failure the pending edits are kept, all of them, including the parts
   * that succeeded. That is safe precisely because the payload is the roster a
   * class should end up with rather than a list of changes: pressing Save again
   * re-sends the successful classes as a no-op and retries the rest. Keeping
   * only the failures would be tidier and would risk showing a board that
   * disagrees with CRM if the retry never happens.
   */
  const save = useCallback(async () => {
    setSaving(true)
    try {
      const result = await applyAllocations({ classes, admissions, pending })

      if (result.ok) {
        const { classCount, admissionCount } = result.summary
        notify({
          tone: 'ok',
          title: 'Changes saved',
          detail:
            `${classCount} class${classCount === 1 ? '' : 'es'} updated` +
            (admissionCount > 0
              ? `, ${admissionCount} admission${admissionCount === 1 ? '' : 's'} re-flagged`
              : '') +
            `, in ${result.calls} call${result.calls === 1 ? '' : 's'}.`,
        })
        reload()
        return result
      }

      notify({
        tone: 'danger',
        title: 'Some changes could not be saved',
        detail:
          'Your edits are still here — press Save to try again. Anything that ' +
          'already saved will simply be reapplied.',
        items: result.failures.slice(0, 6).map((f) => `${f.id}: ${f.message ?? f.status}`),
      })
      return result
    } catch (err) {
      // Reaching here means the call itself failed, so nothing can be assumed
      // about what landed — which is exactly why the edits are left alone.
      notify({
        tone: 'danger',
        title: 'Save failed',
        detail: `${String(err?.message ?? err)} Your changes have been kept.`,
      })
      return null
    } finally {
      setSaving(false)
    }
  }, [classes, admissions, pending, notify, reload])

  const admissionsById = useMemo(
    () => new Map(admissions.map((a) => [a.id, a])),
    [admissions],
  )

  const value = useMemo(() => {
    return {
      pending,
      allocate,
      deallocate,
      resetClass,
      discardAll,
      save,
      saving,

      /** Is anything actually different from what CRM holds? */
      hasChanges: hasPendingChanges(classes, pending),

      /** A class's roster as the user has left it. */
      rosterFor: (cls) => desiredRoster(cls, pending),

      /**
       * A class's roster, ready to render: identity plus student name and
       * admission number, resolved the same way the payload resolves them.
       */
      rosterRowsFor: (cls) => {
        const priorByRowId = priorRowsByRowId(cls)
        return desiredRoster(cls, pending).map((entry, i) => ({
          ...resolveRosterRow(entry, priorByRowId, admissionsById),
          // Falls back to the index only for a row with neither id, which
          // should not occur but must not collapse two rows onto one key.
          key: entry.rowId ?? entry.admissionId ?? `row-${i}`,
        }))
      },

      /** Is this admission in this class, after pending changes? */
      isAllocatedTo: (cls, admissionId) =>
        desiredRoster(cls, pending).some((e) => e.admissionId === admissionId),

      /**
       * Every admission sitting in some class once pending edits are applied.
       *
       * This is what the waiting panel is the complement of, so un-allocating a
       * student in the dialog puts their card back on the left in the same
       * render.
       */
      allocatedAdmissionIds: projectedAllocatedIds(classes, pending),

      /** Everything this save would send. Pure — safe to call for inspection. */
      buildPayload: () => buildSavePayload({ classes, admissions, pending }),
    }
  }, [
    pending,
    classes,
    admissions,
    admissionsById,
    save,
    saving,
    allocate,
    deallocate,
    resetClass,
    discardAll,
  ])

  return <AllocationsContext.Provider value={value}>{children}</AllocationsContext.Provider>
}

export function useAllocations() {
  const ctx = useContext(AllocationsContext)
  if (!ctx) throw new Error('useAllocations() must be used within <AllocationsProvider>')
  return ctx
}
