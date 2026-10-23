import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth redirects must never be cached, otherwise the browser reuses a stale
// "/ -> /signin" redirect after login and skips the new auth cookie.
function redirectTo(path: string, request: NextRequest) {
  const response = NextResponse.redirect(new URL(path, request.url))
  response.headers.set('Cache-Control', 'no-store, must-revalidate')
  return response
}

// Pages that must be reachable without a session.
const PUBLIC_PAGES = ['/signin', '/signup', '/forgot-pin']

export function proxy(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const { pathname } = request.nextUrl

  // Always allow the auth routes, seeding (guarded by SEED_SECRET) and the
  // OpenAPI spec that the Swagger UI needs before it can render.
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/seed') ||
    pathname.startsWith('/api/openapi')
  ) {
    return NextResponse.next()
  }

  // Every other API route is JSON: answer 401 rather than redirecting an API
  // client to an HTML sign-in page.
  if (pathname.startsWith('/api/')) {
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const isPublicPage = PUBLIC_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`)
  )

  // The auth pages stay reachable even when a session exists. Bouncing a
  // signed-in person to the app here would trap them: an account that stopped
  // half-way through setup is sent by `/` right back to `/signin` to sign in
  // again and resume, and a signed-in person may want to switch accounts.
  if (isPublicPage) {
    return NextResponse.next()
  }

  // Everything else needs a session.
  if (!token) {
    return redirectTo('/signin', request)
  }

  return NextResponse.next()
}

// `webmanifest` matters as much as the image extensions: the browser fetches
// the manifest while the user is still signed out, and an unmatched manifest
// would be answered with the /signin HTML — which the browser then reports as
// "Manifest: Line: 1, column: 1, Syntax error."
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|webmanifest|woff|woff2|ttf|otf)).*)',
  ],
}
