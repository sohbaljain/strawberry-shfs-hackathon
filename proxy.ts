import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });
  const supabase = createClient(request, response);
  const pathname = request.nextUrl.pathname;
  const isCitizenPublicRoute = pathname === "/citizen" || pathname.startsWith("/citizen/");

  if (isCitizenPublicRoute) {
    return response;
  }

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims) && !error;
  const isPolicePath = isPoliceOnlyPath(pathname);
  const isSharedProtectedPath = pathname === "/settings";

  if ((isPolicePath || isSharedProtectedPath) && !isAuthenticated) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";

    return copyAuthCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (pathname === "/login" && isAuthenticated) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";

    return copyAuthCookies(response, NextResponse.redirect(redirectUrl));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard",
    "/login",
    "/citizen",
    "/citizen/:path*",
    "/citizen/login",
    "/cases/:path*",
    "/analysis/:path*",
    "/case-assistant/:path*",
    "/oversight",
    "/settings",
    "/citizen-requests",
    "/citizen-requests/:path*",
  ],
};

function copyAuthCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  for (const [key, value] of source.headers) {
    if (key === "set-cookie" || key === "x-middleware-next") continue;
    target.headers.set(key, value);
  }

  return target;
}

function isPoliceOnlyPath(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname === "/oversight" ||
    pathname.startsWith("/cases") ||
    pathname.startsWith("/analysis") ||
    pathname.startsWith("/case-assistant")
  );
}
