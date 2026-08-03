import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { BOOTSTRAP_TASKS, runBootstrap } from './bootstrap.js'
import TimetableSkeleton from '../components/TimetableSkeleton.jsx'
import LoadError from '../components/LoadError.jsx'

const DataContext = createContext(null)

function initialProgress() {
  return Object.fromEntries(BOOTSTRAP_TASKS.map((t) => [t.key, { status: 'queued' }]))
}

/** Dev-only escape hatch: ?loading=1 pins the skeleton so it can be reviewed. */
function skeletonPinned() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has('loading')
}

/**
 * Loads the bootstrap data set, showing the schedule skeleton until it settles.
 *
 * Children mount only once loading has finished, so screens can assume their
 * data is present rather than guarding every read.
 */
export function DataProvider({ children }) {
  const [progress, setProgress] = useState(initialProgress)
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const startedFor = useRef(-1)

  useEffect(() => {
    // Guard against StrictMode's double-mount firing two boot runs.
    if (startedFor.current === attempt) return
    startedFor.current = attempt
    const mine = attempt

    setProgress(initialProgress())
    setResult(null)

    // Staleness is judged against the ref, NOT an unmount flag.
    //
    // The obvious `let cancelled = false` + cleanup pattern is wrong here and
    // deadlocks the app: StrictMode mounts, unmounts, remounts. Cleanup sets
    // cancelled = true, so the in-flight run's result is thrown away — and the
    // remount is skipped by the guard above, so nothing ever restarts. The app
    // sits on the skeleton forever. It only looked fine while the task list was
    // empty, because Promise.all([]) settles in a microtask that lands before
    // cleanup runs; the first genuinely async task exposed it.
    //
    // Comparing against startedFor means a superseded retry is ignored while a
    // merely-remounted run still delivers.
    runBootstrap((key, state) => {
      if (startedFor.current !== mine) return
      setProgress((prev) => ({ ...prev, [key]: { ...prev[key], ...state } }))
    }).then((res) => {
      if (startedFor.current === mine) setResult(res)
    })
  }, [attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (!result || skeletonPinned()) return <TimetableSkeleton />

  if (Object.keys(result.errors).length > 0) {
    return <LoadError errors={result.errors} onRetry={retry} />
  }

  return (
    <DataContext.Provider value={{ ...result.data, progress, reload: retry }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData() must be used within <DataProvider>')
  return ctx
}
