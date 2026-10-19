import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth redirects must never be cached, otherwise the browser reuses a stale
// "/ -> /signin" redirect after login and skips the new auth cookie.
function redirectTo(path: string, request: NextRequest) {
  const response = NextResponse.redirect(new URL(path, request.url))
  response.headers.set('Cache-Control', 'no-store, must-revalidate')
  return response
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const { pathname } = request.nextUrl

  // Always allow API auth routes, the OpenAPI spec and static assets
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/seed') ||
    pathname.startsWith('/api/test-db') ||
    pathname.startsWith('/api/debug-cookies') ||
    pathname.startsWith('/api/openapi')
  ) {
    return NextResponse.next()
  }

  // Redirect authenticated users away from /signin
  if (pathname.startsWith('/signin') && token) {
    return redirectTo('/', request)
  }

  // Redirect unauthenticated users to /signin for protected pages
  if (!pathname.startsWith('/signin') && !token) {
    return redirectTo('/signin', request)
  }

  // Protect API routes (except auth routes above)
  if (pathname.startsWith('/api/') && !token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff|woff2|ttf|otf)).*)'],
}
