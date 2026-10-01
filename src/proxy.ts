import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Optimistic check only: bounce visitors with no session cookie to /login.
// The cookie's signature and the user's role are verified server-side by
// requireAdmin() in every page and action — this file is a convenience, not security.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the login page, invite links (/join: the one-time token is the
  // check), the Google/Microsoft sign-in callback (/api/auth: its signed state cookie is
  // the check), Next internals, static files, and Netlify's own function endpoints (the
  // workers authenticate their calls themselves).
  matcher: ["/((?!login|join|api/auth/|_next/static|_next/image|favicon.ico|\\.netlify).*)"],
};
