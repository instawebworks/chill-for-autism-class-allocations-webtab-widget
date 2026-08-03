/**
 * Shown when bootstrap data fails to load.
 *
 * Deliberately blocks the app rather than rendering a half-populated schedule:
 * a timetable silently missing rooms or sessions is more dangerous than one
 * that refuses to open, because it looks correct.
 */
export default function LoadError({ errors, onRetry }) {
  const entries = Object.entries(errors ?? {})

  return (
    <div className="bg-bg flex h-full items-center justify-center overflow-auto p-6">
      <div className="border-line bg-surface animate-rise w-full max-w-md rounded-2xl border p-7">
        <div className="bg-danger/15 text-danger flex h-10 w-10 items-center justify-center rounded-full">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 6v5M10 13.6v.4" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-fg mt-4 text-base font-semibold tracking-[-0.01em]">
          Couldn’t load the schedule
        </h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Some data didn’t come back from CRM. Nothing has been opened, so you
          aren’t looking at a partial timetable.
        </p>

        {entries.length > 0 && (
          <ul className="border-line mt-4 space-y-2 border-t pt-4">
            {entries.map(([key, message]) => (
              <li key={key} className="text-xs">
                <span className="text-fg font-medium capitalize">{key}</span>
                <span className="text-subtle block font-mono break-all">{message}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onRetry}
          className="bg-brand hover:bg-brand-strong mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 active:scale-[0.99]"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
