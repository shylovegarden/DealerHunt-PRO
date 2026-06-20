import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // We wrap this in a try-catch because if the Supabase environment
  // variables are not set yet, we don't want the entire app to crash during dev.
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => {
            cookies.forEach((cookie: { name: string; value: string; options?: Record<string, unknown> }) => {
              res.cookies.set(cookie.name, cookie.value, cookie.options as any)
            })
          },
        },
      }
    );
    const { data: { session } } = await supabase.auth.getSession();

    // Redirect unauthenticated users to login if they try to hit dashboard
    // Currently disabled for smooth development flow. Enable when auth UI is ready.
    /*
    if (!session && req.nextUrl.pathname.match(/^\/(find|scan|deal|move|fleet|finance|parts|settings)/)) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    */
  } catch (e) {
    // Supabase keys not set yet, allow pass-through
  }

  // Rate limit API routes could go here using Upstash Redis
  // const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';

  return res;
}

export const config = {
  // Only run middleware on the dashboard and API routes
  matcher: [
    '/(find|scan|deal|move|fleet|finance|parts|settings)/:path*', 
    '/api/:path*'
  ],
};
