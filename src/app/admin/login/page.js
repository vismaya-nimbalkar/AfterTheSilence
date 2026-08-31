"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [rememberMe, setRememberMe] =
    useState(true);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [passkeyLoading, setPasskeyLoading] =
    useState(false);

  // ------------------------------------------------------------
  // REMEMBER ME
  // ------------------------------------------------------------

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(
          "after-the-silence-remember-me"
        );

      if (saved !== null) {
        setRememberMe(
          saved === "true"
        );
      }
    } catch {
      setRememberMe(true);
    }
  }, []);

  const saveRememberPreference = (
    value
  ) => {
    setRememberMe(value);

    try {
      localStorage.setItem(
        "after-the-silence-remember-me",
        String(value)
      );
    } catch {}
  };

  // ------------------------------------------------------------
  // CHECK MFA
  // ------------------------------------------------------------

  const checkMFAAndContinue =
    async (supabase) => {
      const {
        data,
        error,
      } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (error) {
        throw error;
      }

      console.log(
        "Supabase AAL:",
        data
      );

      // --------------------------------------------------------
      // MFA REQUIRED
      // --------------------------------------------------------

      if (
        data.nextLevel ===
          "aal2" &&
        data.currentLevel !==
          "aal2"
      ) {
        router.replace(
          "/admin/login/mfa"
        );

        return;
      }

      // --------------------------------------------------------
      // FULLY AUTHENTICATED
      // --------------------------------------------------------

      router.replace("/admin");
      router.refresh();
    };

  // ------------------------------------------------------------
  // PASSWORD LOGIN
  // ------------------------------------------------------------

  const handleLogin = async (
    event
  ) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      localStorage.setItem(
        "after-the-silence-remember-me",
        String(rememberMe)
      );
    } catch {}

    const supabase =
      createClient();

    try {
      const {
        data: { user },
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email:
              email.trim(),
            password,
          }
        );

      if (error) {
        setError(
          "Incorrect email or password."
        );

        setLoading(false);
        return;
      }

      await checkMFAAndContinue(
        supabase
      );

    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setError(
        error?.message ||
          "Something went wrong while signing in."
      );

      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // PASSKEY LOGIN
  // ------------------------------------------------------------

  const handlePasskeyLogin =
    async () => {
      setError("");
      setPasskeyLoading(true);

      try {
        localStorage.setItem(
          "after-the-silence-remember-me",
          String(rememberMe)
        );
      } catch {}

      const supabase =
        createClient();

      try {
        const {
          error,
        } =
          await supabase.auth.signInWithPasskey();

        if (error) {
          console.error(
            "Passkey login error:",
            error
          );

          setError(
            error.message ||
              "Could not sign in with your passkey."
          );

          setPasskeyLoading(false);
          return;
        }

        await checkMFAAndContinue(
          supabase
        );

      } catch (error) {
        console.error(
          "Passkey login error:",
          error
        );

        setError(
          error?.message ||
            "Could not sign in with your passkey."
        );

        setPasskeyLoading(false);
      }
    };

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  return (
    <main className="min-h-screen flex items-center justify-center px-6">

      <div className="w-full max-w-md">

        <div className="mb-10 text-center">

          <h1 className="text-3xl font-bold">
            After The Silence
          </h1>

          <p className="mt-2 text-sm opacity-70">
            Log in with your email and password
          </p>

        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-6"
        >

          <div>

            <label
              htmlFor="email"
              className="
                mb-2
                block
                text-sm
                font-medium
              "
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              required
              autoComplete="email"
              className="
                w-full
                rounded-lg
                border
                border-dark/30
                bg-transparent
                px-4
                py-3
                outline-none
                focus:border-dark
              "
              placeholder="you@example.com"
            />

          </div>

          <div>

            <label
              htmlFor="password"
              className="
                mb-2
                block
                text-sm
                font-medium
              "
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                required
                autoComplete="current-password"
                className="
                  w-full
                  rounded-lg
                  border
                  border-dark/30
                  bg-transparent
                  px-4
                  py-3
                  pr-12
                  outline-none
                  focus:border-dark
                "
                placeholder="••••••••"
              />

              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  rounded-md
                  p-2
                  opacity-60
                  transition-opacity
                  hover:opacity-100
                "
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

          </div>

          <label
            htmlFor="remember-me"
            className="
              flex
              cursor-pointer
              items-center
              gap-3
              select-none
            "
          >

            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) =>
                saveRememberPreference(
                  event.target.checked
                )
              }
              className="
                h-4
                w-4
                rounded
                border-dark/30
              "
            />

            <span className="text-sm">
              Remember me
            </span>

          </label>

          {error && (
            <div
              className="
                rounded-lg
                border
                border-red-500/30
                bg-red-500/5
                px-4
                py-3
                text-sm
                text-red-600
              "
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              passkeyLoading
            }
            className="
              w-full
              rounded-lg
              bg-dark
              px-4
              py-3
              font-medium
              text-light
              dark:bg-light
              dark:text-dark
              transition-opacity
              hover:opacity-80
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>

        </form>

        <div className="my-6 flex items-center gap-4">

          <div className="h-px flex-1 bg-dark/20" />

          <span className="text-xs opacity-50">
            OR
          </span>

          <div className="h-px flex-1 bg-dark/20" />

        </div>

        <button
          type="button"
          onClick={
            handlePasskeyLogin
          }
          disabled={
            loading ||
            passkeyLoading
          }
          className="
            w-full
            rounded-lg
            border
            border-dark/30
            px-4
            py-3
            font-medium
            transition-colors
            hover:bg-dark/5
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {passkeyLoading
            ? "Waiting for passkey..."
            : "Sign in with Passkey"}
        </button>

      </div>

    </main>
  );
}