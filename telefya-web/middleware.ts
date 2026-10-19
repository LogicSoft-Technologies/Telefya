import { NextResponse, type NextRequest } from "next/server";

const platformPrefixes = [
  "/lobby",
  "/live",
  "/speaker",
  "/host",
  "/attendee",
  "/admin",
];

const authPrefixes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

const noIndexPrefixes = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/choose-plan",
  "/admin",
  "/analytics",
  "/attendee",
  "/billing",
  "/conference-lobby",
  "/host",
  "/live",
  "/lobby",
  "/meetings",
  "/recording",
  "/settings",
  "/speaker",
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPlatformRoute = platformPrefixes.some((prefix) =>
    matchesPrefix(pathname, prefix),
  );

  const isAuthRoute = authPrefixes.some((prefix) =>
    matchesPrefix(pathname, prefix),
  );

  const shouldNoIndex = noIndexPrefixes.some((prefix) =>
    matchesPrefix(pathname, prefix),
  );

  const cookieToken =
    request.cookies.get("telefya_access_token")?.value ||
    request.cookies.get("accessToken")?.value ||
    request.cookies.get("token")?.value;

  if (isAuthRoute && cookieToken) {
    const next = request.nextUrl.searchParams.get("next");

    const destination =
      next &&
      next.startsWith("/") &&
      !next.startsWith("//") &&
      !next.startsWith("/\\")
        ? next
        : "/lobby";

    return NextResponse.redirect(
      new URL(destination, request.url),
    );
  }

  const response = NextResponse.next();

  if (shouldNoIndex) {
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive",
    );
  }

  if (isPlatformRoute && !cookieToken) {
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/choose-plan",

    "/admin/:path*",
    "/analytics/:path*",
    "/attendee/:path*",
    "/billing/:path*",
    "/conference-lobby/:path*",
    "/host/:path*",
    "/live/:path*",
    "/lobby/:path*",
    "/meetings/:path*",
    "/recording/:path*",
    "/settings/:path*",
    "/speaker/:path*",
  ],
};