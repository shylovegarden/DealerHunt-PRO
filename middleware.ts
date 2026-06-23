import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protected routes that require authentication.
// Note: '/' is intentionally PUBLIC — the landing page handles its own
// auth check and redirects logged-in users to /find.
const protectedRoutes = [
  // Dashboard pages — all live behind auth; '/' (landing), '/login', '/register' stay public.
  "/scan",
  "/discover",
  "/find",
  "/map",
  "/bulk",
  "/saved",
  "/move",
  "/fleet",
  "/recon",
  "/finance",
  "/parts",
  "/list",
  "/insights",
  "/onboarding",
  "/status",
  "/compare",
  "/deal-check",
  "/developer",
  "/overview",
  "/changelog",
  "/upgrade",
  "/deal",
  "/searches",
  "/alerts",
  "/settings",
  // User-scoped APIs.
  "/api/inventory",
  "/api/alerts",
  "/api/watchlist",
  "/api/dealers",
  "/api/outcomes",
  "/api/calibration",
  "/api/saved-cars",
];

// Auth routes
const authRoutes = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Check if current route is protected ('/' is public — handled by the landing page)
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  // Check if current route is an auth route
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged-in users shouldn't see the auth pages — send them into the app.
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/find";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
