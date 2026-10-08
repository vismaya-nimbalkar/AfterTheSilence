import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getUserRole } from "@/src/lib/admin/permissions";

export async function proxy(request) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  const pathname =
    request.nextUrl.pathname;

  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  const isLoginRoute =
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/");

  const isMFARoute =
    pathname === "/admin/login/mfa";

  const isSecurityRoute =
    pathname === "/admin/security";

  if (!isAdminRoute) {
    return response;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (isLoginRoute) {
      return response;
    }

    return NextResponse.redirect(
      new URL(
        "/forbidden",
        request.url
      )
    );
  }

  const {
    data: aal,
    error: aalError,
  } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError) {
    console.error(
      "Could not determine MFA assurance level:",
      aalError
    );

    return NextResponse.redirect(
      new URL(
        "/forbidden",
        request.url
      )
    );
  }

  const currentLevel =
    aal?.currentLevel;

  const nextLevel =
    aal?.nextLevel;

  const mfaRequired =
    nextLevel === "aal2" &&
    currentLevel !== "aal2";

  const securitySetupRequired =
    getUserRole(user) === "editor" &&
    user.user_metadata?.security_reset_required === true;

  if (securitySetupRequired) {
    if (isSecurityRoute) {
      return response;
    }

    return NextResponse.redirect(
      new URL(
        "/admin/security",
        request.url
      )
    );
  }

  if (mfaRequired) {
    if (isMFARoute) {
      return response;
    }

    return NextResponse.redirect(
      new URL(
        "/admin/login/mfa",
        request.url
      )
    );
  }

  if (
    pathname === "/admin/login"
  ) {
    return NextResponse.redirect(
      new URL(
        "/admin",
        request.url
      )
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
  ],
};