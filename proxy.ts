import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });
  const supabase = createClient(request, response);
  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims) && !error;
  const pathname = request.nextUrl.pathname;

  if (isProtectedAppPath(pathname) && !isAuthenticated) {
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
    "/cases/:path*",
    "/analysis/:path*",
    "/case-assistant/:path*",
    "/oversight",
    "/settings",
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

function isProtectedAppPath(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname === "/oversight" ||
    pathname === "/settings" ||
    pathname.startsWith("/cases") ||
    pathname.startsWith("/analysis") ||
    pathname.startsWith("/case-assistant")
  );
}
