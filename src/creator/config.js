/**
 * Zoho Creator public endpoints.
 *
 * The publickey travels in the URL and therefore ships to the browser — that is
 * inherent to Creator's "public" published functions, not something the widget
 * can hide. Treat these endpoints as world-readable and never publish one that
 * returns data we would not hand to an anonymous caller.
 *
 * CORS: Creator rejects browser requests from any origin not listed under the
 * function's permitted domains, answering 401 / code 2945
 * (UNAUTHORIZED_CORS_REQUEST) even though the OPTIONS preflight succeeds.
 * Both crm.zoho.com.au and the dev origin have to be whitelisted there.
 */

export const CREATOR_BASE = 'https://www.zohoapis.com.au/creator/custom/chillforautism'

/**
 * The public key is issued PER CUSTOM API, not per application.
 *
 * This is easy to get wrong, because with one published function a single shared
 * constant behaves identically — and then the second function is added, inherits
 * the first one's key, and answers 401 / code 9370 ("invalid public key for this
 * Custom API") in a way that reads like the endpoint is down. Registering the key
 * beside the function name makes the pairing explicit, and an unregistered
 * function fails loudly here rather than at the far end.
 *
 * Retired: `getTermBreakTerms` (key HyT0kM0BjXP4PAwB0GJf1D4pp) returned every
 * term ever recorded. Superseded by getCurrentAndFutureTerms — see creator/terms.js.
 */
export const CREATOR_FUNCTIONS = {
  getCurrentAndFutureTerms: 'JJjE45buzZw63kvZnssbXyrpv',
}

/** Creator answers 3000 on success; anything else is an error payload. */
export const CREATOR_OK = 3000

export function creatorUrl(fn, params = {}) {
  const publickey = CREATOR_FUNCTIONS[fn]
  if (!publickey) {
    throw new Error(
      `creatorUrl: no public key registered for Creator function "${fn}". Add it to CREATOR_FUNCTIONS.`,
    )
  }

  const url = new URL(`${CREATOR_BASE}/${fn}`)
  url.searchParams.set('publickey', publickey)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}
