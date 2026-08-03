import { parseRoster } from './allocations.js'

/**
 * Domain accessors for Class records.
 *
 * These exist for one reason: the CRM's seat fields are named backwards.
 *
 *   Allocated_Seats  → labelled "Seats Available" → MAXIMUM capacity
 *   Seats_Allocated  → labelled "Seats Allocated" → CURRENT occupancy
 *
 * The two API names are near-anagrams that mean opposite things, so reading
 * either one inline is a bug waiting to happen. Nothing outside this file should
 * mention them by name.
 */

/** Maximum admissions this class can hold. */
export function capacityOf(cls) {
  return Number(cls?.Allocated_Seats ?? 0)
}

/**
 * Seats taken.
 *
 * Prefers the roster snapshot, because that is the list itself rather than a
 * number describing it — if the two ever disagree, the rows are what a person
 * can actually be shown. `Seats_Allocated` is the fallback for a class the
 * workflow has not yet touched, and both are written by the same pass, so they
 * agree in normal operation.
 */
export function occupancyOf(cls) {
  const roster = parseRoster(cls)
  if (roster.status === 'ok' || roster.status === 'empty') return roster.rows.length
  return Number(cls?.Seats_Allocated ?? 0)
}

export function seatsRemaining(cls) {
  return Math.max(0, capacityOf(cls) - occupancyOf(cls))
}

export function isFull(cls) {
  return capacityOf(cls) > 0 && occupancyOf(cls) >= capacityOf(cls)
}

/** 0–1, clamped. Safe when capacity is zero or missing. */
export function fillRatio(cls) {
  const cap = capacityOf(cls)
  if (!cap) return 0
  return Math.min(1, occupancyOf(cls) / cap)
}

export function isActive(cls) {
  return cls?.Class_Active === 'Yes'
}

/** Lookup fields arrive as { name, id } or null. */
export function lookupName(value) {
  return value?.name ?? null
}

/** The location lookup on Classes is spelled `Loction` in the CRM schema. */
export function locationOf(cls) {
  return cls?.Loction ?? null
}
