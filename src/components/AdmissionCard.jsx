import { lookupName } from '../domain/classes.js'
import { programLabel } from '../domain/schedule.js'

/**
 * One student waiting for a place.
 *
 * The admission number and programme share the top line as metadata, leaving
 * the student name alone on its own line as the thing you actually scan for.
 * Pairing the two short values on one row buys back a whole row of height per
 * card, which matters in a queue that will run to hundreds.
 *
 * The programme dot borrows its colour from the matching class on the board, so
 * a card and its destination are visibly the same programme.
 *
 * `session` is the slot this admission's programme is enrolled in, already
 * shortened ("Mon 2pm"); `sessionTitle` is the full text as written on the
 * Selected Programs List, surfaced as the line's tooltip. Both come from the
 * enrolment via domain/selectedPrograms.js.
 *
 * This is the family's actual commitment — what the invoice and the service
 * agreement are written against — and NOT their ranked preference list. The
 * distinction is the whole point: preferences live on the enrolment, so a
 * family taking two programmes had the same day and time printed on both
 * cards. The line only renders when there is something to say; a programme
 * missing from the Selected Programs List shows no session rather than
 * borrowing one from elsewhere.
 */
export default function AdmissionCard({ admission, colour, session, sessionTitle }) {
  const student = lookupName(admission.Student_Name) ?? 'Unnamed student'
  const program = programLabel(admission.Program_Name)

  return (
    <article className="border-line bg-surface-2 hover:border-line-strong rounded-lg border px-2.5 py-2 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-subtle shrink-0 font-mono text-[10px] leading-none">
          {admission.Name}
        </span>

        <span className="flex min-w-0 items-center gap-1">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${colour ? '' : 'bg-line-strong'}`}
            style={colour ? { backgroundColor: colour } : undefined}
            aria-hidden="true"
          />
          <span className="text-muted min-w-0 truncate text-[10px]" title={admission.Program_Name}>
            {program}
          </span>
        </span>
      </div>

      <p className="text-fg mt-1 truncate text-[13px] leading-tight font-semibold" title={student}>
        {student}
      </p>

      {session && (
        <p
          className="text-subtle mt-1 flex items-center gap-1 text-[10px] leading-none"
          title={sessionTitle ? `Enrolled session: ${sessionTitle}` : undefined}
        >
          <svg
            viewBox="0 0 12 12"
            className="h-2.5 w-2.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="4.7" />
            <path d="M6 3.6V6l1.7 1.2" strokeLinecap="round" />
          </svg>
          {/* "Enrolled", not "Prefers". The word is load-bearing: this is the
              session the family is committed to and invoiced for, and calling
              it a preference is what let a wrong slot read as merely advisory. */}
          <span className="truncate">
            Enrolled <span className="text-muted font-medium">{session}</span>
          </span>
        </p>
      )}
    </article>
  )
}
