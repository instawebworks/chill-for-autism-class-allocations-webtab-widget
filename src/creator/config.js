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

export const CREATOR_PUBLIC_KEY = 'HyT0kM0BjXP4PAwB0GJf1D4pp'

/** Creator answers 3000 on success; anything else is an error payload. */
export const CREATOR_OK = 3000

export function creatorUrl(fn, params = {}) {
  const url = new URL(`${CREATOR_BASE}/${fn}`)
  url.searchParams.set('publickey', CREATOR_PUBLIC_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}
