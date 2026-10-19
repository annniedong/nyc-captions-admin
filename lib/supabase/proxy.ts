import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Everything else in the app requires a signed-in superadmin.
const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const response = NextResponse.redirect(url);
    // Keep any refreshed session cookies on the redirect.
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return isPublic ? supabaseResponse : redirectTo("/login");
  }

  if (path === "/login") return redirectTo("/");
  if (path.startsWith("/auth/callback")) return supabaseResponse;

  // Signed in. Only a superadmin gets past this point; the database enforces it too.
  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");
  if (isSuperadmin !== true) {
    return path === "/denied" ? supabaseResponse : redirectTo("/denied");
  }
  if (path === "/denied") return redirectTo("/");

  return supabaseResponse;
}
