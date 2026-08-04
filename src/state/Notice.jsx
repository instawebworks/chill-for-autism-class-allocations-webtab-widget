import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import NoticeBanner from '../components/Notice.jsx'

const NoticeContext = createContext(null)

/**
 * One place that owns "tell the user something", and one banner that shows it.
 *
 * Deliberately mounted ABOVE DataProvider. A successful save reloads the data
 * set, which unmounts everything below it — so a message owned any lower would
 * be destroyed by the very thing it was reporting on, and the save would appear
 * to have said nothing at all.
 *
 * Messages that resolve themselves fade out; ones the user must act on do not,
 * because a failure list that disappears while it is being read is worse than
 * no list at all.
 */

const AUTO_DISMISS_MS = 5000

export function NoticeProvider({ children }) {
  const [notice, setNotice] = useState(null)
  const timer = useRef(null)
  const seq = useRef(0)

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setNotice(null)
  }, [clearTimer])

  /**
   * @param {object}  n
   * @param {'ok'|'info'|'warn'|'danger'} n.tone
   * @param {string}  n.title
   * @param {string} [n.detail]
   * @param {string[]} [n.items]  e.g. the records that failed
   * @param {boolean} [n.sticky]  stay until dismissed. Defaults to true for
   *   anything the user has to act on, since those carry the detail that
   *   matters and should not time out mid-read.
   */
  const notify = useCallback(
    (n) => {
      clearTimer()
      seq.current += 1
      setNotice({ ...n, id: seq.current })

      const sticky = n.sticky ?? (n.tone === 'danger' || n.tone === 'warn')
      if (!sticky) timer.current = setTimeout(() => setNotice(null), AUTO_DISMISS_MS)
    },
    [clearTimer],
  )

  useEffect(() => clearTimer, [clearTimer])

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss])

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <NoticeBanner notice={notice} onDismiss={dismiss} />
    </NoticeContext.Provider>
  )
}

export function useNotice() {
  const ctx = useContext(NoticeContext)
  if (!ctx) throw new Error('useNotice() must be used within <NoticeProvider>')
  return ctx
}
