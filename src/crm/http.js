import { withTimeout } from '../lib/timeout.js'

/**
 * Outbound HTTP through the CRM host rather than the browser.
 *
 * ZOHO.CRM.HTTP.get proxies the call server-side (the SDK routes it through its
 * "CONNECTOR" channel), so the request reaches the target from Zoho's
 * infrastructure and never becomes a cross-origin browser request. That matters
 * for the Creator endpoints: Creator refuses browser requests from
 * non-whitelisted origins with 401 / code 2945, and no amount of client code can
 * talk its way past that. Proxying sidesteps the question entirely.
 *
 * From the SDK source, the accepted shape is:
 *   { url, params, headers, body, CONTENT_TYPE, RESPONSE_TYPE }
 * with `params` URL-encoded and appended to the query string.
 */

function http() {
  const h = window.ZOHO?.CRM?.HTTP
  if (!h) throw new Error('ZOHO.CRM.HTTP unavailable — called outside CRM?')
  return h
}

export function canProxy() {
  return !!window.ZOHO?.CRM?.HTTP?.get
}

/**
 * GET a URL via the CRM proxy and parse the result as JSON.
 *
 * The proxy hands back a string for most content types, but has been seen to
 * return an already-parsed object depending on RESPONSE_TYPE — so handle both
 * rather than assuming.
 */
export async function proxyGetJson(url, { params, headers, ms = 20000, label = 'proxy GET' } = {}) {
  const res = await withTimeout(
    http().get({
      url,
      ...(params ? { params } : {}),
      headers: { Accept: 'application/json', ...(headers ?? {}) },
      RESPONSE_TYPE: 'json',
    }),
    { ms, label },
  )

  const payload = res?.details?.statusMessage ?? res?.body ?? res

  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch {
      throw new Error(`${label}: response was not JSON — ${payload.slice(0, 180)}`)
    }
  }
  return payload
}
