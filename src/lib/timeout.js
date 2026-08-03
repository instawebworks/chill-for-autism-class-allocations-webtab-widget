/**
 * Deadline wrappers for remote calls.
 *
 * Every remote call in this widget gets one. The CRM JS SDK in particular
 * returns a promise that simply never settles when the host frame does not
 * answer, which presents as an eternal loading screen with no error anywhere —
 * the failure mode is indistinguishable from slowness, so it must be converted
 * into a real error.
 */

export class TimeoutError extends Error {
  constructor(label, ms) {
    super(`${label} timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

/** Rejects if `promise` has not settled within `ms`. */
export function withTimeout(promise, { ms = 15000, label = 'request' } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/**
 * fetch() with a deadline that actually aborts the request, rather than just
 * abandoning a promise that keeps the connection open behind it.
 */
export async function fetchWithTimeout(url, { ms = 15000, label = 'request', ...init } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw new TimeoutError(label, ms)
    throw err
  } finally {
    clearTimeout(timer)
  }
}
