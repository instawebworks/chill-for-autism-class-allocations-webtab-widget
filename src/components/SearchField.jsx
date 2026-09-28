import { useId } from 'react'

/**
 * A compact search box.
 *
 * Controlled, and deliberately without any filtering logic of its own — it
 * reports what was typed and nothing else, so the rule for what a query matches
 * lives next to the data it judges rather than inside a text input.
 *
 * `type="search"` for the semantics, with the browser's own clear button
 * suppressed: Chrome renders one and Firefox does not, so leaving it in place
 * would mean two clear buttons on one platform and one on another. The button
 * below is drawn in the widget's own language and behaves the same everywhere.
 *
 * Escape clears without closing anything. It is safe here because focus can
 * only be in this field when no dialog is open — a dialog traps focus — so the
 * key cannot be stolen from a dialog that wanted it.
 */
export default function SearchField({ value, onChange, label, placeholder }) {
  const id = useId()

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <svg
        viewBox="0 0 14 14"
        className="text-subtle pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="6.2" cy="6.2" r="4.2" />
        <path d="M9.4 9.4 12.2 12.2" strokeLinecap="round" />
      </svg>

      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value !== '') {
            event.preventDefault()
            onChange('')
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck="false"
        className="border-line bg-surface-2 text-fg placeholder:text-subtle focus:border-brand focus:ring-brand/40 w-full rounded-lg border py-1.5 pr-7 pl-7 text-[12px] transition-colors outline-none focus:ring-2 [&::-webkit-search-cancel-button]:appearance-none"
      />

      {value !== '' && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="text-subtle hover:text-fg absolute top-1/2 right-1.5 flex h-4 w-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded transition-colors"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
            <path
              d="M3 3l6 6M9 3l-6 6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
