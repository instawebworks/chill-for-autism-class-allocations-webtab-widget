/**
 * Checkbox.
 *
 * A real <input type="checkbox"> underneath — `appearance-none` restyles the box
 * without giving up the native semantics, keyboard behaviour, or form
 * participation that a div-with-a-tick would throw away. The tick is an
 * overlaid SVG so it can be coloured for the dark surface.
 */
export default function Checkbox({ checked, onChange, label, id }) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="border-line-strong checked:border-brand checked:bg-brand h-4 w-4 cursor-pointer appearance-none rounded border bg-transparent transition-colors"
      />
      {checked && (
        <svg
          viewBox="0 0 16 16"
          className="pointer-events-none absolute h-3 w-3 text-white"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3.5 8.5 6.3 11.3 12.5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}
