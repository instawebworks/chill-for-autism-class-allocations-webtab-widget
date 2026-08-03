/**
 * Detection of the host CRM environment.
 *
 * The rule for this widget: it runs inside Zoho CRM or it does nothing at all.
 * Everything downstream may assume the SDK is live and the handshake has landed.
 *
 * Detection deliberately hangs forever when we are not inside CRM rather than
 * rejecting. A rejection would invite an error screen, and an error screen is a
 * surface an unauthenticated visitor can read. Staying on the loading screen
 * leaks nothing and matches the spec: "outside CRM the widget does nothing".
 *
 * The handshake is a process-wide singleton so that React 19 StrictMode's
 * double-mount (and any later remount) cannot start competing handshakes or
 * strand a resolved one behind an abandoned promise.
 */

/** Observable handshake state — drives the dev-only diagnostics panel. */
export const diagnostics = {
  sdkPresent: null, // bool once checked
  initOutcome: 'pending', // 'pending' | 'resolved' | 'rejected'
  initError: null,
  pageLoad: 'pending', // 'pending' | 'received'
  startedAt: Date.now(),
}

const watchers = new Set()

function publish(patch) {
  Object.assign(diagnostics, patch)
  watchers.forEach((fn) => fn({ ...diagnostics }))
}

/** Subscribe to handshake state changes. Returns an unsubscribe fn. */
export function watchDiagnostics(fn) {
  watchers.add(fn)
  fn({ ...diagnostics })
  return () => watchers.delete(fn)
}

/** Is the Embedded App SDK present on the page at all? */
function sdkPresent() {
  return typeof window !== 'undefined' && !!window.ZOHO?.embeddedApp
}

function startHandshake() {
  return new Promise((resolve) => {
    if (!sdkPresent()) {
      publish({ sdkPresent: false })
      console.info('[crm] Embedded App SDK absent — not running inside CRM. Idling.')
      return // never resolves, by design
    }
    publish({ sdkPresent: true })

    // The listener must be registered before init(); PageLoad is emitted during
    // init and a listener attached afterwards misses it entirely.
    window.ZOHO.embeddedApp.on('PageLoad', (payload) => {
      publish({ pageLoad: 'received' })
      console.info('[crm] PageLoad received — CRM host confirmed.')
      resolve(payload ?? {})
    })

    // init() is the primary signal, not PageLoad.
    //
    // From the SDK source: init() builds a promise that resolves from ZSDK's
    // OnLoad callback, which only fires once the CRM host frame answers. There
    // is no reject path wired up at all — outside CRM the promise simply stays
    // pending forever. That is exactly the behaviour this gate wants, so the
    // .catch() below is defensive only and is not expected to run.
    //
    // PageLoad is a separate host-emitted event carrying record context. A
    // top-band Web Tab has no record, so PageLoad may never arrive even though
    // we are legitimately inside CRM. Gating on it alone would hang forever.
    window.ZOHO.embeddedApp
      .init()
      .then(() => {
        publish({ initOutcome: 'resolved' })
        console.info('[crm] init() resolved — CRM host confirmed.')
        resolve({ via: 'init', entity: null })
      })
      .catch((err) => {
        publish({ initOutcome: 'rejected', initError: String(err?.message ?? err) })
        console.info('[crm] init() rejected — not inside CRM. Idling.', err)
      })
  })
}

let handshake = null

/**
 * Resolves once we are certain we are embedded in CRM. Never rejects, never
 * resolves outside CRM. Safe to call from any number of components — they all
 * share the single underlying handshake.
 */
export function awaitCrmHandshake() {
  if (!handshake) handshake = startHandshake()
  return handshake
}
