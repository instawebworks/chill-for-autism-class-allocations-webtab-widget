import { lookupName } from '../domain/classes.js'
import { programLabel } from '../domain/schedule.js'

/**
 * One student waiting for a place.
 *
 * Two rows rather than three: the admission number and programme share the top
 * line as metadata, leaving the student name alone on its own line as the thing
 * you actually scan for. Pairing the two short values on one row buys back a
 * whole row of height per card, which matters in a queue that will run to
 * hundreds.
 *
 * The programme dot borrows its colour from the matching class on the board, so
 * a card and its destination are visibly the same programme.
 */
export default function AdmissionCard({ admission, colour }) {
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
    </article>
  )
}
