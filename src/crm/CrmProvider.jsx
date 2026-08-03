import { createContext, useContext, useEffect, useState } from 'react'
import { awaitCrmHandshake } from './sdk.js'
import LoadingScreen from '../components/LoadingScreen.jsx'

const CrmContext = createContext(null)

/**
 * Gates the entire app behind a confirmed CRM host.
 *
 * Children are not mounted until PageLoad has fired, so no child ever has to
 * defend against a missing SDK — `useCrm()` is guaranteed to return a live
 * context. Outside CRM the loading screen stays up indefinitely.
 */
export function CrmProvider({ children }) {
  const [pageLoad, setPageLoad] = useState(null)

  useEffect(() => {
    let cancelled = false
    awaitCrmHandshake().then((payload) => {
      if (!cancelled) setPageLoad(payload)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!pageLoad) return <LoadingScreen />

  return <CrmContext.Provider value={{ pageLoad }}>{children}</CrmContext.Provider>
}

/** Only callable from inside CrmProvider's subtree, where CRM is guaranteed. */
export function useCrm() {
  const ctx = useContext(CrmContext)
  if (!ctx) throw new Error('useCrm() must be used within <CrmProvider>')
  return ctx
}
