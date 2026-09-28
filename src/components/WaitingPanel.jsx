import { useMemo, useState } from 'react'
import { useData } from '../crm/DataProvider.jsx'
import { useWorkspace } from '../state/Workspace.jsx'
import { useAllocations } from '../state/Allocations.jsx'
import { colourForProgram, programColours } from '../domain/programs.js'
import {
  enrolledSessionFor,
  selectedProgramsByEnrollment,
  shortSession,
} from '../domain/selectedPrograms.js'
import { searchAdmissions } from '../domain/search.js'
import DraggableAdmissionCard from './DraggableAdmissionCard.jsx'
import SearchField from './SearchField.jsx'

/**
 * Students in the current term and location who have not yet been placed in a
 * class — i.e. Admissions with Allocated? unticked.
 *
 * Titled "Awaiting Placement" rather than "Unallocated": the panel is a queue of
 * work, and naming it by what needs to happen reads better than naming it by the
 * absence of a database flag. The count sits in the title because "how many are
 * left" is the question this panel exists to answer.
 *
 * The list scrolls inside itself so the page never does. `min-h-0` on the scroll
 * container is load-bearing rather than tidiness: a flex item defaults to
 * `min-height: auto` and refuses to shrink below its content, so without it the
 * div grows to fit every card, `overflow-y-auto` never engages, and the overflow
 * is silently clipped by the panel's `overflow-hidden`. With three admissions
 * nothing looks wrong; at a hundred, most of the queue would be unreachable.
 */
export default function WaitingPanel() {
  const { admissions, classes } = useWorkspace()
  const { allocatedAdmissionIds } = useAllocations()
  // Enrolments come straight from the data layer: the selected programmes
  // belong to the enrolment, which is not location-scoped the way this panel's
  // admissions are.
  const { enrollments = [] } = useData()

  const colours = useMemo(() => programColours(classes), [classes])
  const sessionsByEnrollment = useMemo(
    () => selectedProgramsByEnrollment(enrollments),
    [enrollments],
  )

  /**
   * Waiting = not in any class roster once pending edits are applied.
   *
   * Derived from the rosters rather than from the `Allocated` checkbox. The two
   * can disagree — CRM currently holds at least one admission sitting in a class
   * while flagged unallocated — and the roster is the stronger evidence, since
   * it is the allocation itself rather than a flag describing it. Reading the
   * flag instead would show the same student on the board and in this queue at
   * once, and would leave un-allocating with no visible effect here until the
   * save round-tripped.
   */
  const sorted = useMemo(
    () =>
      admissions
        .filter((a) => !allocatedAdmissionIds.has(a.id))
        .sort((a, b) =>
          String(a.Name ?? '').localeCompare(String(b.Name ?? ''), undefined, { numeric: true }),
        ),
    [admissions, allocatedAdmissionIds],
  )

  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''

  /**
   * The search is a display lens over `sorted`, applied last and kept out of
   * everything above it. `sorted` stays the real queue, so the count in the
   * header — and any future answer to "is anyone left to place?" — is unaffected
   * by whatever happens to be typed in the box.
   */
  const visible = useMemo(() => searchAdmissions(sorted, query), [sorted, query])

  return (
    <aside className="border-line bg-surface flex w-[clamp(200px,17%,300px)] shrink-0 flex-col overflow-hidden rounded-2xl border">
      <header className="border-line shrink-0 border-b px-3.5 pt-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-fg text-[13px] font-semibold tracking-[-0.01em]">
            Awaiting Placement
          </h2>
          {/* The whole queue, never the filtered view. This badge answers "how
              many are left to place", which a search does not change — and a
              number that dropped to 2 while someone typed would quietly misreport
              the size of the term's remaining work. The match count lives in the
              line below instead. */}
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              sorted.length > 0 ? 'bg-brand/20 text-brand-strong' : 'bg-surface-3 text-subtle'
            }`}
          >
            {sorted.length}
          </span>
        </div>
        {/* Only worth showing once the queue is long enough to need it. At
            three admissions a search box is furniture; at a hundred it is the
            only way to find anybody. */}
        {sorted.length > 5 && (
          <div className="mt-2.5">
            <SearchField
              value={query}
              onChange={setQuery}
              label="Search awaiting placement by student name or admission number"
              placeholder="Name or ADM number…"
            />
          </div>
        )}

        {/* Doubles as the search's result line. aria-live so the match count is
            announced as it changes — without it a screen-reader user types into
            a box and is told nothing at all. */}
        <p className="text-subtle mt-1.5 text-[11px]" aria-live="polite">
          {searching ? `${visible.length} of ${sorted.length} shown` : 'Not yet in a class'}
        </p>
      </header>

      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center">
          <div className="bg-ok/15 text-ok flex h-9 w-9 items-center justify-center rounded-full">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 10.5l3.2 3.2L15 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-muted text-xs">Everyone is placed</p>
          <p className="text-subtle text-[11px]">
            No admissions are waiting for this term and location.
          </p>
        </div>
      ) : visible.length === 0 ? (
        /* Kept distinct from "Everyone is placed" on purpose. The two look the
           same — an empty list — but mean opposite things, and telling someone
           mid-search that the queue is clear would be a plain lie about the
           state of their term. This one names the query and offers the way out. */
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center">
          <div className="bg-surface-3 text-subtle flex h-9 w-9 items-center justify-center rounded-full">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="8.8" cy="8.8" r="5.8" />
              <path d="M13.2 13.2 17 17" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-muted text-xs">No matches</p>
          <p className="text-subtle text-[11px]">
            Nobody awaiting placement matches “{query.trim()}”.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-brand-strong cursor-pointer text-[11px] font-medium hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
          {visible.map((admission) => {
            // The session THIS admission's programme is enrolled in — not the
            // enrolment's first preference, which is shared across every
            // programme the family took and so said the same thing on all of
            // their cards. Null where the programme is not on the enrolment's
            // list at all; the card then shows no session rather than a
            // plausible wrong one.
            const session = enrolledSessionFor(admission, sessionsByEnrollment)
            return (
              <DraggableAdmissionCard
                key={admission.id}
                admission={admission}
                colour={colourForProgram(colours, admission.Program_Name)}
                session={shortSession(session)}
                sessionTitle={session?.sessionTime ?? null}
              />
            )
          })}
        </div>
      )}
    </aside>
  )
}
