import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/auth/signup', '/auth/error', '/']
  const isPublicRoute = publicRoutes.some(route => pathname === route)

  // API routes that should be accessible
  const isApiRoute = pathname.startsWith('/api/')
  const isAuthApiRoute = pathname.startsWith('/api/auth/')

  // Allow public routes and API routes
  if (isPublicRoute || isAuthApiRoute) {
    return NextResponse.next()
  }

  // Redirect to signin if not logged in and trying to access protected route
  if (!isLoggedIn && !isApiRoute) {
    const signInUrl = new URL('/auth/signin', req.nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // For API routes, return 401 if not authenticated
  if (!isLoggedIn && isApiRoute) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
