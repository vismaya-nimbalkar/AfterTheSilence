import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request) {
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

  // ------------------------------------------------------------
  // NOT AN ADMIN ROUTE
  // ------------------------------------------------------------

  if (!isAdminRoute) {
    return response;
  }

  // ------------------------------------------------------------
  // GET USER
  // ------------------------------------------------------------

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // ------------------------------------------------------------
  // NO SESSION
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // CHECK MFA / AAL
  // ------------------------------------------------------------

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

  // ------------------------------------------------------------
  // MFA IS REQUIRED
  //
  // AAL1 = password/passkey authenticated
  // AAL2 = password/passkey + MFA authenticated
  // ------------------------------------------------------------

  const mfaRequired =
    nextLevel === "aal2" &&
    currentLevel !== "aal2";

  // ------------------------------------------------------------
  // USER NEEDS MFA
  // ------------------------------------------------------------

  if (mfaRequired) {
    // Let the MFA page load.
    if (isMFARoute) {
      return response;
    }

    // Send every other admin route to MFA.
    return NextResponse.redirect(
      new URL(
        "/admin/login/mfa",
        request.url
      )
    );
  }

  // ------------------------------------------------------------
  // USER IS ALREADY FULLY AUTHENTICATED
  // ------------------------------------------------------------

  // Don't allow an already-authenticated user
  // to sit on the login page.
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