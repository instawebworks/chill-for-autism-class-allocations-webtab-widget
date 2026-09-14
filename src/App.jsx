import { useData } from './crm/DataProvider.jsx'
import { useWorkspace } from './state/Workspace.jsx'
import { useAllocations } from './state/Allocations.jsx'
import BrandLogo from './components/BrandLogo.jsx'
import LocationPicker from './components/LocationPicker.jsx'
import TermPicker from './components/TermPicker.jsx'
import SaveChangesButton from './components/SaveChangesButton.jsx'
import ScheduleBoard from './components/ScheduleBoard.jsx'
import WaitingPanel from './components/WaitingPanel.jsx'
import { PanelsSkeleton } from './components/TimetableSkeleton.jsx'

/**
 * Widget shell..
 *
 * Fills the iframe exactly — `h-full` off the html/body/#root chain, so it
 * follows whatever height the device or CRM gives it — and never scrolls the
 * page in either axis. Overflow belongs to the panels: the board scrolls
 * vertically inside itself, and the day columns compress rather than pushing the
 * layout sideways.
 *
 * Everything below the header is scoped to the selected term and location.
 * Location is a filter over data already held; term is a refetch. So the header
 * stays mounted while a term loads and only the panels below it go to skeleton —
 * the picker that started the load must not disappear under the pointer that
 * used it.
 */

const RANGE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export default function App() {
  // `selectedTerm`, not `targetTerm`: during a switch the board still holds the
  // old term's records, but the title has to name the term being moved to or it
  // reads as though the click did nothing.
  const { selectedTerm, loading } = useData()
  const { classes, classesWithoutLocation } = useWorkspace()
  const { hasChanges, saving, save } = useAllocations()

  return (
    <div className="bg-bg flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-start justify-between gap-4 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="min-w-0">
            <h1 className="text-fg truncate text-lg font-bold tracking-[-0.02em] sm:text-2xl">
              Program Schedule | {selectedTerm.label}
            </h1>
            <p className="text-muted mt-0.5 truncate text-xs sm:text-sm">
              {RANGE_FMT.format(selectedTerm.start)} — {RANGE_FMT.format(selectedTerm.end)}
            </p>
          </div>
          {/* Term first, then location: term decides what was fetched at all,
              location only narrows it. Reading left to right is then widest
              scope to narrowest. */}
          <div className="shrink-0 pt-0.5">
            <TermPicker />
          </div>
          <div className="shrink-0 pt-0.5">
            <LocationPicker />
          </div>
        </div>
        {/* Right-hand cluster: the commit action, then the brand lockup. Grouped
            rather than left as two siblings of the header's space-between, so the
            button keeps a fixed distance from the logo instead of drifting across
            the header as the title's width changes. */}
        <div className="flex shrink-0 items-start gap-6">
          <div className="shrink-0 pt-0.5">
            {/* Disabled mid-load as well as when nothing is pending: the edits
                are still held, but they describe records that are being replaced,
                and a save landing against a half-swapped data set is not
                something to leave reachable. */}
            <SaveChangesButton disabled={!hasChanges || loading} busy={saving} onSave={save} />
          </div>
          <BrandLogo size="md" className="text-fg shrink-0" />
        </div>
      </header>

      {loading ? (
        <PanelsSkeleton label={`Loading ${selectedTerm.label}…`} />
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 px-4 pb-4 sm:px-6 sm:pb-5">
          {/* Left panel — students still to be placed. */}
          <WaitingPanel />

          {/* Right panel — the weekly board. */}
          <main className="border-line bg-surface min-w-0 flex-1 overflow-hidden rounded-2xl border">
            <ScheduleBoard classes={classes} orphaned={classesWithoutLocation} />
          </main>
        </div>
      )}
    </div>
  )
}
