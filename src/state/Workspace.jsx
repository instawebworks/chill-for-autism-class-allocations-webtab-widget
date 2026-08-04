import { createContext, useContext, useMemo, useState } from 'react'
import { useData } from '../crm/DataProvider.jsx'
import { admissionLocationId, classLocationId, scopeToLocation } from '../domain/locations.js'

const WorkspaceContext = createContext(null)

/**
 * The two scopes every view answers to: the target term, and the selected
 * location.
 *
 * The term is fixed for a session (resolved once at bootstrap). The location is
 * user-controlled, so it lives here rather than inside a component — the picker
 * that sets it and the board that reads it are in different subtrees, and every
 * future panel needs the same value.
 *
 * Location filtering is applied client-side against the already-fetched term
 * data. Switching location is then instant with no refetch, which matters
 * because it is a comparison action people repeat. Data is already bounded by
 * term, so the cost is a filter over a few dozen rows. If the org grows to many
 * large sites, this is the point to push the location into the query instead.
 */
export function WorkspaceProvider({ children }) {
  const { targetTerm, targetTermBasis, locations, classes, admissions } = useData()

  // What the user has asked for, which is not necessarily what exists.
  const [requestedLocationId, setRequestedLocationId] = useState(null)

  /**
   * The location actually in force, resolved during render rather than
   * corrected afterwards by an effect.
   *
   * The effect version worked but had a real flaw: when the location list
   * changed under a stale selection, the component first rendered a board
   * scoped to a site that no longer exists, and only then re-rendered with the
   * fallback. Deriving it means there is no frame in which the scope is wrong.
   *
   * Null only when the org has no locations at all — with one site this is
   * always that site, which is the defined starting point rather than an empty
   * board.
   */
  const locationId = locations.some((l) => l.id === requestedLocationId)
    ? requestedLocationId
    : (locations[0]?.id ?? null)

  const value = useMemo(() => {
    const selectedLocation = locations.find((l) => l.id === locationId) ?? null

    const scopedClasses = scopeToLocation(classes, locationId, classLocationId)
    const scopedAdmissions = scopeToLocation(admissions, locationId, admissionLocationId)

    // Note: who is "awaiting placement" is deliberately NOT derived here.
    // It depends on the session's unsaved edits, which live one layer down in
    // AllocationsProvider — see WaitingPanel. Keeping a second, flag-based
    // definition alongside it would guarantee the two eventually disagree.

    return {
      targetTerm,
      targetTermBasis,
      locations,
      locationId,
      selectedLocation,
      setLocationId: setRequestedLocationId,
      classes: scopedClasses.matched,
      admissions: scopedAdmissions.matched,
      // Records with no location at all: excluded from the board, but reported
      // so a class that is simply missing its site does not disappear silently.
      classesWithoutLocation: scopedClasses.unattributed,
      admissionsWithoutLocation: scopedAdmissions.unattributed,
    }
  }, [targetTerm, targetTermBasis, locations, locationId, classes, admissions])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace() must be used within <WorkspaceProvider>')
  return ctx
}
