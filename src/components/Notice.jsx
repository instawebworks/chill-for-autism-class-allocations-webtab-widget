/**
 * The banner used to tell the user something happened.
 *
 * Shared by the two moments that need it: a drop the rules refused, and the
 * result of a save. One surface rather than two, because they can never appear
 * together and a second style of message would only invite them to drift apart.
 *
 * `role="alert"` rather than a polite live region: in both cases the user has
 * just acted and is waiting on the answer, which should not queue behind
 * whatever a screen reader was already saying.
 */

const TONES = {
  ok: { ring: 'ring-ok/45', accent: 'text-ok' },
  info: { ring: 'ring-brand/40', accent: 'text-brand-strong' },
  warn: { ring: 'ring-warn/45', accent: 'text-warn' },
  danger: { ring: 'ring-danger/45', accent: 'text-danger' },
}

function Glyph({ tone }) {
  if (tone === 'ok') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="10" cy="10" r="7.2" strokeWidth="1.8" />
        <path d="M6.6 10.2 9 12.6l4-4.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (tone === 'info') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="10" cy="10" r="7.2" />
        <path d="M10 9.2v4.2M10 6.6v.4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 2.8 18 16.4H2L10 2.8Z" strokeLinejoin="round" />
      <path d="M10 8v3.4M10 13.6v.4" strokeLinecap="round" />
    </svg>
  )
}

export default function Notice({ notice, onDismiss }) {
  if (!notice) return null
  const tone = TONES[notice.tone] ?? TONES.warn

  // Anchored to the bottom, not the top. At the top it sat over the day
  // headings — structural labels the board is unreadable without — and a
  // failure banner is sticky, so it would cover them until dismissed. The foot
  // of the columns is the least information-dense part of the board, and the
  // conventional place for this besides.
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-60 flex justify-center px-4"
      role="alert"
      aria-live="assertive"
    >
      {/* Keyed on the notice id so an identical second message replays the
          entrance rather than sitting there looking like the first one. */}
      <div
        key={notice.id}
        className={`border-line bg-surface-2 animate-rise pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border px-4 py-3 shadow-[0_20px_44px_-14px_rgba(0,0,0,0.75)] ring-1 ${tone.ring}`}
      >
        <span className={`mt-px shrink-0 ${tone.accent}`}>
          <Glyph tone={notice.tone} />
        </span>
        <div className="min-w-0">
          <p className={`text-[13px] leading-tight font-semibold ${tone.accent}`}>{notice.title}</p>
          {notice.detail && (
            <p className="text-muted mt-1 text-[12px] leading-snug">{notice.detail}</p>
          )}
          {/* Failures are listed rather than counted: "2 classes could not be
              saved" leaves the user with no idea which ones to look at. */}
          {notice.items?.length > 0 && (
            <ul className="text-subtle mt-1.5 space-y-0.5 text-[11px]">
              {notice.items.map((item, i) => (
                <li key={i} className="font-mono break-all">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-subtle -mt-0.5 -mr-1 shrink-0 rounded-lg p-1 transition-colors hover:text-white"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
