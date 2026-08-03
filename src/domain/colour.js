/**
 * Colour handling for values that arrive from CRM.
 *
 * Colours are data, not code: they come off the Class record so the palette can
 * be changed in CRM without a deploy. That means nothing here may assume a
 * well-formed value — a human typing into a text field will eventually produce
 * "0090D2", "#0090d2 ", or "blue".
 */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Normalise to `#rrggbb`, or null if it is not a usable hex colour. */
export function normaliseHex(value) {
  const raw = String(value ?? '').trim()
  if (!HEX.test(raw)) return null

  let hex = raw.replace('#', '').toLowerCase()
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c)
  return `#${hex}`
}

function channels(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** WCAG relative luminance. */
function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function mix(a, b, t) {
  const A = channels(a)
  const B = channels(b)
  return (
    '#' +
    A.map((c, i) => Math.round(c * (1 - t) + B[i] * t))
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  )
}

/** Where a colour is darkened toward, on the way to carrying white text. */
const DEEP = '#06121f'

/**
 * A shade of `hex` dark enough to carry white text.
 *
 * For large colour areas — a dialog header rather than a small pill — flipping
 * to dark text when the fill is light produces navy-on-blue, which is legible on
 * paper and tiring on screen. Darkening the fill instead means the text is
 * always white while the programme colour stays recognisable: Art is still
 * plainly the yellow class, just deeper.
 *
 * Steps toward DEEP until white clears `minRatio`, so vivid colours barely move
 * and pale ones move as far as they need to.
 */
export function shadeForWhiteText(value, minRatio = 5) {
  const base = normaliseHex(value)
  if (!base) return null

  for (let t = 0; t <= 1.0001; t += 0.05) {
    const shade = mix(base, DEEP, t)
    if (contrastRatio(shade, '#ffffff') >= minRatio) return shade
  }
  return DEEP
}

const LIGHT_TEXT = '#ffffff'
const DARK_TEXT = '#0d1b2a'

/**
 * Pick the text colour that is actually readable on `hex`.
 *
 * Computed rather than assumed: the palette mixes very dark fills (#006636
 * money) with very light ones (#FCD242 art, #9CC0E4 life), so a single fixed
 * text colour is unreadable on one end or the other whichever end you choose.
 */
export function readableTextOn(hex) {
  const bg = normaliseHex(hex)
  if (!bg) return LIGHT_TEXT
  return contrastRatio(bg, DARK_TEXT) >= contrastRatio(bg, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT
}

/** `rgba()` form of a hex colour, for borders and glows. */
export function withAlpha(hex, alpha) {
  const norm = normaliseHex(hex)
  if (!norm) return null
  const [r, g, b] = channels(norm)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
