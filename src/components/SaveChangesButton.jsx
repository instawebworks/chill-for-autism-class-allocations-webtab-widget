/**
 * The board's commit action.
 *
 * Disabled is its resting state, not an error state. With nothing changed there
 * is nothing to write, and an always-live Save invites a pointless update that
 * would re-fire the Classes workflow and rewrite the allocation snapshot for no
 * reason.
 *
 * What counts as a "change" is not defined yet, so this component does not
 * decide — it takes `disabled` from its parent. That keeps the rule next to the
 * state it judges and leaves this a pure control, which is also what makes it
 * testable once the rule exists.
 *
 * State is carried by fill rather than by opacity. Dimming the whole button is
 * the usual shortcut and it makes the label hardest to read at exactly the
 * moment someone is trying to work out why they cannot press it.
 *
 * So the disabled button has no fill at all: an outline that sits *into* the
 * header rather than on top of it, which is what stops it reading as pressable.
 * A filled disabled button — even a muted one — renders as a perfectly ordinary
 * secondary button, and the only way to discover otherwise is to click it and
 * get nothing. Gaining the solid brand fill is then the whole visual event of
 * becoming available.
 *
 * The label still clears AA at 4.6:1 on the header. Disabled controls are exempt
 * from that under WCAG 1.4.3, but "you may make it illegible" is not a reason
 * to: someone has to be able to read what they are being denied.
 */

const BASE =
  'inline-flex shrink-0 items-center rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors'

const ENABLED =
  'border-transparent bg-brand text-white hover:bg-brand-strong cursor-pointer active:scale-[0.99]'

const DISABLED = 'border-line bg-transparent text-subtle cursor-not-allowed'

export default function SaveChangesButton({ disabled = true, busy = false, onSave }) {
  // Held open while saving rather than reverting to the disabled look: the
  // button is not unavailable, it is working, and the two states should not
  // read the same. `aria-busy` says so for anyone not looking at it.
  const inert = disabled && !busy

  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy}
      onClick={onSave}
      className={`${BASE} ${inert ? DISABLED : ENABLED} ${busy ? 'cursor-progress' : ''}`}
    >
      {busy && (
        <svg
          viewBox="0 0 16 16"
          className="animate-spin-slow mr-2 -ml-0.5 h-3.5 w-3.5"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="2" opacity="0.3" />
          <path d="M8 1.6a6.4 6.4 0 0 1 6.4 6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {busy ? 'Saving…' : 'Save Changes'}
    </button>
  )
}
