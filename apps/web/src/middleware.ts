import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // VALID-05: Reject requests with Content-Length > 10MB before routing
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null) {
    const size = parseInt(contentLength, 10)
    const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10MB
    if (size > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: 'Request body too large. Maximum size is 10MB.' },
        { status: 413 }
      )
    }
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/api/auth/login', '/api/auth/register'];
  const isApiScans = pathname === '/api/scans' && request.method === 'POST';
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || isApiScans;

  // For public routes, just continue
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Extract token from Authorization header or cookie
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : request.cookies.get('auth-token')?.value;

  if (!token) {
    const isPageRoute = !pathname.startsWith('/api');
    if (isPageRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const isPageRoute = !pathname.startsWith('/api');
    if (isPageRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-email', payload.email);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};