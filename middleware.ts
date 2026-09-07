import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "propark_corporate_mobility_platform_super_secret_2026_key",
  });

  const { pathname } = req.nextUrl;

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/vehicles") ||
    pathname.startsWith("/rides") ||
    pathname.startsWith("/parking") ||
    pathname.startsWith("/notifications");
  const isAdminRoute = pathname.startsWith("/admin");

  // 1. If user is already logged in and tries to access /login or /register
  if (isAuthRoute && token) {
    if (token.role === "admin" || token.role === "campus_admin") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 2. If unauthenticated user tries to access protected employee routes
  if (isProtectedRoute && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. If accessing admin route (Admin-Only)
  if (isAdminRoute) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (token.role !== "admin" && token.role !== "campus_admin") {
      // Forbidden: redirect normal employee to CommuteX employee dashboard
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/vehicles/:path*",
    "/rides/:path*",
    "/parking/:path*",
    "/notifications/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
