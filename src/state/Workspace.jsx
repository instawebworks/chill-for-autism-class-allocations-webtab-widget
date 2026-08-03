import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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

  // Preselect the first location. With a single site this is the only choice;
  // with several it is a defined starting point rather than an empty board.
  const [locationId, setLocationId] = useState(() => locations[0]?.id ?? null)

  // Keep the selection pointing at something real if the list ever changes.
  useEffect(() => {
    if (locations.length === 0) return
    if (!locations.some((l) => l.id === locationId)) {
      setLocationId(locations[0].id)
    }
  }, [locations, locationId])

  const value = useMemo(() => {
    const selectedLocation = locations.find((l) => l.id === locationId) ?? null

    const scopedClasses = scopeToLocation(classes, locationId, classLocationId)
    const scopedAdmissions = scopeToLocation(admissions, locationId, admissionLocationId)

    // "Unallocated" is simply Allocated? being unticked. Compared against `true`
    // rather than negated, because the field reads null on records created
    // before it existed, and null is not the same as "definitely placed".
    const unallocatedAdmissions = scopedAdmissions.matched.filter((a) => a.Allocated !== true)

    return {
      targetTerm,
      targetTermBasis,
      locations,
      locationId,
      selectedLocation,
      setLocationId,
      classes: scopedClasses.matched,
      admissions: scopedAdmissions.matched,
      unallocatedAdmissions,
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
