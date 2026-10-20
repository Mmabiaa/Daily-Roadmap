import { NextResponse } from 'next/server'
import { z } from 'zod'

import { accountFor, type Account } from './accounts'
import { getSession } from './auth'
import { ApiError } from './errors'

export { ApiError }

/** Path parameters of the matched route, empty for a route with no segments. */
export type RouteParams = Record<string, string | string[]>

/** Resolves the account behind the session cookie, or `null`. */
export async function currentAccount(): Promise<Account | null> {
  return accountFor(await getSession())
}

/** The signed-in account, or a 401 for the caller. */
export async function requireUser(): Promise<Account> {
  const account = await currentAccount()
  if (!account) throw new ApiError(401, 'Unauthorized')
  return account
}

type RouteHandler = (
  request: Request,
  context?: { params?: Promise<RouteParams> }
) => Promise<Response>

/**
 * Wraps a route handler with the three things every JSON route here does:
 * resolve the account, validate the body, and turn a thrown error into a
 * response. Handlers describe their happy path and nothing else.
 */
export function route<Body = undefined>(
  spec: {
    /** Validates the JSON body. Omit for routes that take none. */
    body?: z.ZodType<Body>
    /** Fixed message for a rejected body; defaults to the first Zod issue. */
    invalidBody?: string
    /** Message for an unexpected failure, also used when logging it. */
    failure: string
  },
  handler: (input: {
    request: Request
    user: Account
    params: RouteParams
    body: Body
  }) => Promise<Response>
): RouteHandler {
  return async (request, context) => {
    try {
      const user = await requireUser()
      const params = (await context?.params) ?? {}
      const body = spec.body
        ? parseBody(spec.body, spec.invalidBody, await request.json())
        : (undefined as Body)

      return await handler({ request, user, params, body })
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      console.error(spec.failure, error)
      return NextResponse.json({ error: spec.failure }, { status: 500 })
    }
  }
}

function parseBody<Body>(schema: z.ZodType<Body>, invalidBody: string | undefined, raw: unknown): Body {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return parsed.data

  throw new ApiError(400, invalidBody ?? parsed.error.issues[0]?.message ?? 'Invalid request body')
}
