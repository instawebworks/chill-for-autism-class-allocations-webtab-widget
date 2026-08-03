import TimetableSkeleton from './TimetableSkeleton.jsx'
import HandshakeDiagnostics from './HandshakeDiagnostics.jsx'

/**
 * Pre-handshake screen — the only thing rendered before CRM is confirmed, and
 * therefore the only thing ever rendered outside CRM.
 *
 * Reuses the schedule skeleton so the handshake and the data load read as one
 * continuous loading state rather than two different screens. The skeleton
 * carries no records, module names, or counts, so it stays safe to show to
 * someone who never gets past this point.
 */
export default function LoadingScreen() {
  return (
    <div className="h-full">
      <TimetableSkeleton label="Loading…" />

      {import.meta.env.DEV && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-6">
          <div className="pointer-events-auto w-full max-w-sm">
            <HandshakeDiagnostics />
          </div>
        </div>
      )}
    </div>
  )
}
