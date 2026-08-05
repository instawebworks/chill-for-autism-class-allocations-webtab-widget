import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BOOTSTRAP_TASKS, runBootstrap } from './bootstrap.js'
import { useNotice } from '../state/Notice.jsx'
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
 * Loads the bootstrap data set, and re-loads it when the term changes.
 *
 * ---------------------------------------------------------------------------
 * Why a term switch is a full refetch
 * ---------------------------------------------------------------------------
 *
 * Location is a lens: it filters records already in memory, so switching sites
 * is instant. Term is not. Classes and Admissions are *fetched* with term
 * criteria, so a different term is a different result set — there is nothing
 * client-side to re-filter. The term is therefore an input to the bootstrap
 * rather than a view setting, and changing it re-runs the whole thing.
 *
 * ---------------------------------------------------------------------------
 * The first load and a re-load are deliberately different
 * ---------------------------------------------------------------------------
 *
 * With nothing loaded there is nothing to keep, so the first attempt owns the
 * screen: full skeleton, then either data or an error page.
 *
 * A re-load keeps the last good data mounted and merely raises `loading`. That
 * is what lets the header — and specifically the term picker that was just
 * used — stay put instead of being replaced by a skeleton, which reads as the
 * widget restarting. Panels below decide for themselves what to show while it
 * runs.
 *
 * It also makes failure recoverable. A re-load that fails keeps the previous
 * term on screen and puts the picker back to it, so a term with broken data is
 * a message rather than a dead end. Showing the error page instead would strand
 * the user there with no control to pick a different term with.
 */
export function DataProvider({ children }) {
  const { notify } = useNotice()

  const [progress, setProgress] = useState(initialProgress)
  const [loaded, setLoaded] = useState(null)
  const [fatal, setFatal] = useState(null)
  const [loading, setLoading] = useState(true)

  /**
   * Bumped on every successful load. Anything holding state derived from this
   * data set — the session's pending allocations — watches it and resets.
   */
  const [generation, setGeneration] = useState(0)

  /**
   * One state value for "which run, against which term".
   *
   * `n` is the attempt number and the only thing that starts a run; `termId` is
   * that run's input. Kept together so a term switch is a single update rather
   * than two that could interleave and start a run against the wrong term.
   */
  const [run, setRun] = useState({ n: 0, termId: null })

  const startedFor = useRef(-1)
  // The effect closes over its own render's state, so the "do we already have
  // good data?" question has to be asked of a ref, not of `loaded`.
  const loadedRef = useRef(null)

  useEffect(() => {
    // Guard against StrictMode's double-mount firing two boot runs.
    if (startedFor.current === run.n) return
    startedFor.current = run.n
    const mine = run.n

    setProgress(initialProgress())
    setLoading(true)

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
    runBootstrap(
      (key, state) => {
        if (startedFor.current !== mine) return
        setProgress((prev) => ({ ...prev, [key]: { ...prev[key], ...state } }))
      },
      { selectedTermId: run.termId },
    ).then((res) => {
      if (startedFor.current !== mine) return
      setLoading(false)

      if (Object.keys(res.errors).length === 0) {
        loadedRef.current = res
        setFatal(null)
        setLoaded(res)
        setGeneration((g) => g + 1)
        // Re-point the selection at what actually loaded. Normally identical;
        // it differs when the chosen term has rolled out of the feed's window
        // and resolveTargetTerm fell back to its rules. Syncing here is what
        // keeps the picker showing the term the board is really scoped to.
        //
        // Changing `termId` alone re-runs this effect, which the guard above
        // then returns from — so this costs a render, not a refetch.
        setRun((r) => (r.termId === res.data.targetTerm.id ? r : { ...r, termId: res.data.targetTerm.id }))
        return
      }

      if (!loadedRef.current) {
        setFatal(res.errors)
        return
      }

      const kept = loadedRef.current.data.targetTerm
      setRun((r) => (r.termId === kept.id ? r : { ...r, termId: kept.id }))
      notify({
        tone: 'danger',
        title: 'Could not load that term',
        detail: `Still showing ${kept.label}, with your changes untouched.`,
        items: Object.entries(res.errors)
          .slice(0, 4)
          .map(([key, message]) => `${key}: ${message}`),
      })
    })
  }, [run, notify])

  const reload = useCallback(() => setRun((r) => ({ ...r, n: r.n + 1 })), [])

  const setTerm = useCallback((termId) => {
    setRun((r) => (r.termId === termId ? r : { n: r.n + 1, termId }))
  }, [])

  const value = useMemo(() => {
    if (!loaded) return null

    const terms = loaded.data.terms ?? []
    // The term the user has asked for, which during a re-load is not yet the
    // term the board holds. The header follows this so the title and the picker
    // change the instant they are used, rather than lagging a fetch behind.
    const selectedTerm = terms.find((t) => t.id === run.termId) ?? loaded.data.targetTerm

    return {
      ...loaded.data,
      progress,
      reload,
      loading,
      generation,
      terms,
      selectedTerm,
      setTerm,
    }
  }, [loaded, run.termId, progress, reload, loading, generation, setTerm])

  if (!loaded && fatal) return <LoadError errors={fatal} onRetry={reload} />
  if (!loaded || skeletonPinned()) return <TimetableSkeleton />

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData() must be used within <DataProvider>')
  return ctx
}
