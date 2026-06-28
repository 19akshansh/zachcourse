import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up", 
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Always allow auth API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }
  
  // Always allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }
  
  // Check session cookie for protected routes
  const req = request as any
  const sessionCookie = 
    req.cookies?.get("better-auth.session_token") ||
    req.cookies?.get("__Secure-better-auth.session_token")
    
  if (!sessionCookie && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
