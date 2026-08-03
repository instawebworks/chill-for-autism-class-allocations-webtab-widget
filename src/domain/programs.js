import { normaliseHex } from './colour.js'

/**
 * Programme → colour, derived from the Class records currently loaded.
 *
 * Colours live on Classes, not Admissions, so an admission has no colour of its
 * own. Rather than inventing a second palette, the waiting list borrows the
 * colour of a class teaching the same programme — the same "Art" is the same
 * yellow whether it is a session on the board or a student waiting for one.
 *
 * Consequence worth knowing: a programme with no class in the current term and
 * location has no colour to borrow, and renders neutral.
 */
export function programColours(classes = []) {
  const map = new Map()
  for (const cls of classes) {
    const program = cls?.Program
    const hex = normaliseHex(cls?.Class_Color_Code)
    if (program && hex && !map.has(program)) map.set(program, hex)
  }
  return map
}
