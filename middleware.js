import { NextResponse } from "next/server";

// Custom domain routing middleware
// When a request comes in on a custom domain (e.g. listings.bestrealagent.com),
// we rewrite it to /[slug]/property/[bookingId] by looking up the tenant mapping.
//
// The tenant's slug is embedded in the URL path if they set it up correctly,
// or we fetch the slug from a lightweight edge-safe lookup.
//
// NOTE: Vercel/full domain mapping requires adding the domain in the Vercel project settings.
// This middleware handles the *routing* once the request reaches Next.js.

const PLATFORM_HOST = process.env.NEXT_PUBLIC_APP_DOMAIN || "";

export function middleware(request) {
  const host = request.headers.get("host") || "";

  // Strip port for local dev
  const hostname = host.split(":")[0];

  // Always pass through localhost, Vercel preview/deployment domains,
  // and the configured platform domain.
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isVercel    = hostname.endsWith(".vercel.app");
  const isPlatform  = PLATFORM_HOST && (hostname === PLATFORM_HOST || hostname.endsWith(`.${PLATFORM_HOST}`));

  // If no custom domain env var is set, or we're on a known platform host — skip entirely.
  if (isLocalhost || isVercel || isPlatform || !PLATFORM_HOST) {
    return NextResponse.next();
  }

  // At this point we're on an unknown hostname — treat it as a custom domain.

  // Custom domain — rewrite to the custom-domain handler page
  // which will look up the tenant by domain and render the right content
  const { pathname, search } = request.nextUrl;

  // Don't rewrite API routes or static files
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Rewrite everything to the custom domain landing handler
  // Pass the original hostname as a header so the page can look up the tenant
  const url = request.nextUrl.clone();
  url.pathname = `/custom-domain${pathname === "/" ? "" : pathname}`;

  const response = NextResponse.rewrite(url);
  response.headers.set("x-custom-domain", hostname);
  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
