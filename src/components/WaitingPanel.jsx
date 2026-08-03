import { useMemo } from 'react'
import { useWorkspace } from '../state/Workspace.jsx'
import { programColours } from '../domain/programs.js'
import AdmissionCard from './AdmissionCard.jsx'

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
  const { unallocatedAdmissions, classes } = useWorkspace()

  const colours = useMemo(() => programColours(classes), [classes])

  const sorted = useMemo(
    () =>
      [...unallocatedAdmissions].sort((a, b) =>
        String(a.Name ?? '').localeCompare(String(b.Name ?? ''), undefined, { numeric: true }),
      ),
    [unallocatedAdmissions],
  )

  return (
    <aside className="border-line bg-surface flex w-[clamp(200px,17%,300px)] shrink-0 flex-col overflow-hidden rounded-2xl border">
      <header className="border-line shrink-0 border-b px-3.5 pt-3.5 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-fg text-[13px] font-semibold tracking-[-0.01em]">
            Awaiting Placement
          </h2>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              sorted.length > 0 ? 'bg-brand/20 text-brand-strong' : 'bg-surface-3 text-subtle'
            }`}
          >
            {sorted.length}
          </span>
        </div>
        <p className="text-subtle mt-0.5 text-[11px]">Not yet in a class</p>
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
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
          {sorted.map((admission) => (
            <AdmissionCard
              key={admission.id}
              admission={admission}
              colour={colours.get(admission.Program_Name)}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
