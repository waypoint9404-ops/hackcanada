import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function middleware(request: NextRequest) {
  const authRes = await auth0.middleware(request);

  // Let Auth0 handle its own routes
  if (request.nextUrl.pathname.startsWith("/auth")) {
    return authRes;
  }

  // Public routes — no session required
  const publicPaths = ["/", "/api/auth", "/api/share-target"];
  const isPublic = publicPaths.some(
    (p) =>
      request.nextUrl.pathname === p ||
      request.nextUrl.pathname.startsWith(p + "/")
  );

  if (isPublic) {
    return authRes;
  }

  // Everything else requires authentication
  const session = await auth0.getSession(request);

  if (!session) {
    // API routes return 401, page routes redirect to login
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.redirect(
      new URL("/auth/login?returnTo=" + encodeURIComponent(request.nextUrl.pathname), request.nextUrl.origin)
    );
  }

  return authRes;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icons, manifest
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.json|sw\\.js|workbox-|.*\\.svg$).*)",
  ],
};
