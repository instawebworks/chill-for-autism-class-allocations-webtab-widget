/**
 * The full Chill for Autism lockup: wordmark, blue full stop, and the
 * "for autism" line beneath. Rendered whole or not at all — a truncated
 * "chill." on its own is a different mark and misrepresents the organisation.
 *
 * This is a typographic reconstruction, not the official artwork. The real logo
 * uses a heavy geometric sans that we do not bundle, so letterforms will be
 * close rather than exact. Drop the official SVG at public/brand/chill.svg and
 * swap the wordmark below for an <img> when it is available — a brand mark
 * should be the supplied asset wherever one exists.
 *
 * The wordmark inherits `currentColor` so it sits correctly on navy, on white,
 * or on any surface it is placed against; only the dot is fixed to brand blue.
 */

/**
 * `gap` is the breathing room under the wordmark. The tagline sits on its own
 * baseline in the real mark rather than tucking under the descender, so these
 * are positive offsets — negative ones crowd the two lines into a single block.
 */
const SIZES = {
  sm: { word: 'text-lg', tag: 'text-[7px]', gap: 'mt-0' },
  md: { word: 'text-2xl', tag: 'text-[9px]', gap: 'mt-0.5' },
  lg: { word: 'text-3xl sm:text-4xl', tag: 'text-[10px] sm:text-[11px]', gap: 'mt-0.5' },
}

export default function BrandLogo({ size = 'md', className = '' }) {
  const s = SIZES[size] ?? SIZES.md

  return (
    <span
      className={`inline-flex flex-col items-center leading-none ${className}`}
      role="img"
      aria-label="Chill for Autism"
    >
      <span className={`${s.word} font-extrabold tracking-[-0.05em]`}>
        chill<span className="text-brand">.</span>
      </span>
      <span
        className={`${s.tag} ${s.gap} font-medium tracking-[0.14em] opacity-90`}
        aria-hidden="true"
      >
        for autism
      </span>
    </span>
  )
}
