import { useEffect, useState } from 'react'
import { watchDiagnostics } from '../crm/sdk.js'

/**
 * Dev-only. Surfaces why the CRM handshake has not landed after a few seconds,
 * so a stuck spinner is diagnosable instead of mysterious.
 *
 * Never included in a production build (guarded by import.meta.env.DEV at the
 * call site), so it cannot become an information leak outside CRM.
 */
export default function HandshakeDiagnostics({ revealAfterMs = 3000 }) {
  const [state, setState] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => watchDiagnostics(setState), [])
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), revealAfterMs)
    return () => clearTimeout(t)
  }, [revealAfterMs])

  if (!visible || !state) return null

  const rows = [
    ['SDK on page', state.sdkPresent === null ? 'not checked' : state.sdkPresent ? 'yes' : 'NO'],
    ['init()', state.initOutcome + (state.initError ? ` — ${state.initError}` : '')],
    ['PageLoad', state.pageLoad],
    ['in iframe', window.self !== window.top ? 'yes' : 'NO'],
    ['origin', window.location.origin],
  ]

  return (
    <div className="border-line bg-surface/85 animate-rise rounded-xl border p-3.5 backdrop-blur-xl">
      <p className="text-subtle mb-2 text-[11px] font-medium tracking-wide uppercase">
        Handshake diagnostics · dev only
      </p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-3 text-xs">
            <dt className="text-subtle w-24 shrink-0">{k}</dt>
            <dd className="text-fg min-w-0 flex-1 font-mono break-all">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
