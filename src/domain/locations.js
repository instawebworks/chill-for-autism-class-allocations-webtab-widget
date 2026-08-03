/**
 * Location accessors.
 *
 * Each module names its location link differently, and one of them is
 * misspelled in the CRM schema, so the field names are contained here rather
 * than repeated across components.
 */

/** Classes link to a location via `Loction` — the typo is in the CRM schema. */
export function classLocationId(cls) {
  return cls?.Loction?.id ?? null
}

export function admissionLocationId(adm) {
  return adm?.Location_Name?.id ?? null
}

/**
 * Filter by location, keeping records whose location cannot be read out of the
 * result but counting them, so they can be reported rather than vanishing.
 */
export function scopeToLocation(records, locationId, idOf) {
  if (!locationId) return { matched: records, unattributed: [] }

  const matched = []
  const unattributed = []
  for (const record of records) {
    const id = idOf(record)
    if (id === locationId) matched.push(record)
    else if (id == null) unattributed.push(record)
  }
  return { matched, unattributed }
}
