import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Redirect to login page after clearing cookie
  const response = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  )

  // Clear auth cookie
  response.cookies.delete('auth-token')

  return response
}
