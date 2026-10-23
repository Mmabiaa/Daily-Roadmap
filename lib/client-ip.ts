import { isIP } from 'node:net'

/**
 * Works out which client an auth request came from.
 *
 * A header like `x-forwarded-for` is trivially spoofable, so it is only read
 * when the deployment says a trusted proxy sets it (`TRUST_PROXY_HEADERS`).
 * Anything that is not a literal IP is rejected rather than hashed into a
 * bucket, so junk values cannot be used to manufacture unlimited buckets.
 */

export const DEFAULT_IP_HEADER = 'x-forwarded-for'

/** Environment lookup, kept generic so tests can pass a plain object. */
export type IpEnv = Record<string, string | undefined>

/** Set `TRUST_PROXY_HEADERS=true` only behind a proxy that overwrites the header. */
export function trustProxyHeaders(env: IpEnv = process.env): boolean {
  const value = env.TRUST_PROXY_HEADERS
  return value === 'true' || value === '1'
}

/** Which header carries the client IP. Defaults to `x-forwarded-for`. */
export function configuredIpHeader(env: IpEnv = process.env): string {
  return (env.TRUSTED_IP_HEADER || DEFAULT_IP_HEADER).trim().toLowerCase()
}

/**
 * Pulls a client IP out of a proxy header value.
 *
 * `x-forwarded-for` is a list with the original client first, so only that
 * first entry is trusted — everything after it was appended by other hops.
 */
export function parseClientIp(
  value: string | null | undefined,
  headerName: string = DEFAULT_IP_HEADER
): string | null {
  if (!value) return null
  const first = headerName.toLowerCase() === DEFAULT_IP_HEADER ? value.split(',')[0] : value
  const candidate = first?.trim()
  if (!candidate) return null
  return isIP(candidate) ? candidate : null
}

/**
 * The client IP for a request, or `null` when it cannot be determined or
 * cannot be trusted. Callers skip IP-based limiting on `null` rather than
 * lumping every unknown client into one bucket.
 */
export function clientIpFrom(
  request: Request,
  env: IpEnv = process.env
): string | null {
  if (!trustProxyHeaders(env)) return null
  const header = configuredIpHeader(env)
  return parseClientIp(request.headers.get(header), header)
}
