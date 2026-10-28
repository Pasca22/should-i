import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/shared/auth/server";

/**
 * Pages need a signed-in user: no session → /login; already signed in → away from /login.
 * The session is fully validated (database lookup), not just the cookie's presence, so a stale
 * cookie can't bounce between /login and the app. API routes check the session themselves.
 */
export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const onLogin = request.nextUrl.pathname === "/login";
  if (onLogin && session) return NextResponse.redirect(new URL("/run", request.url));
  if (!onLogin && !session) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  // /admin also checks that the user is an admin, in the page and in each Server Action.
  matcher: ["/login", "/run/:path*", "/hike/:path*", "/feedback/:path*", "/admin/:path*"],
};
