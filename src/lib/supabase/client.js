import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  let rememberMe = true;

  if (typeof window !== "undefined") {
    try {
      const savedPreference =
        localStorage.getItem(
          "after-the-silence-remember-me"
        );

      if (savedPreference !== null) {
        rememberMe =
          savedPreference === "true";
      }
    } catch {
      rememberMe = true;
    }
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,

        experimental: {
          passkey: true,
        },

        storage:
          typeof window !== "undefined"
            ? rememberMe
              ? window.localStorage
              : window.sessionStorage
            : undefined,
      },
    }
  );
}