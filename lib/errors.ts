/**
 * The one error a handler throws to answer with a specific status.
 *
 * Kept in its own module with no imports so both the HTTP wrapper (`lib/api.ts`)
 * and the schedule service (`lib/schedule-service.ts`) can use it without the
 * service dragging Next.js's request machinery into a plain Node process — which
 * is what the integration tests run in.
 */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
