"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const checkMFAAndContinue = async (supabase) => {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      throw error;
    }

    /*
     * If the user has MFA enabled:
     *
     * currentLevel = aal1
     * nextLevel = aal2
     *
     * This means they have successfully entered
     * their password/passkey, but still need their
     * authenticator code.
     */
    if (
      data.nextLevel === "aal2" &&
      data.currentLevel !== "aal2"
    ) {
      router.push("/admin/login/mfa");
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    const supabase = createClient();

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        setError("Incorrect email or password.");
        setLoading(false);
        return;
      }

      await checkMFAAndContinue(supabase);
    } catch (error) {
      console.error("Admin login error:", error);

      setError(
        error?.message ||
          "Something went wrong while signing in."
      );

      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setPasskeyLoading(true);

    const supabase = createClient();

    try {
      const { error } =
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

      /*
       * A passkey has successfully authenticated
       * the user. If TOTP MFA is also enabled,
       * check whether the MFA challenge is still
       * required.
       */
      await checkMFAAndContinue(supabase);
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

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">

        {/* Header */}

        <div className="text-center mb-10">

          <h1 className="text-3xl font-bold">
            After The Silence
          </h1>

          <p className="mt-2 text-sm opacity-70">
            Admin Login
          </p>

        </div>


        {/* Password Login */}

        <form
          onSubmit={handleLogin}
          className="space-y-6"
        >

          {/* Email */}

          <div>

            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
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


          {/* Password */}

          <div>

            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
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
                outline-none
                focus:border-dark
              "
              placeholder="••••••••"
            />

          </div>


          {/* Error */}

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


          {/* Password button */}

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


        {/* Divider */}

        <div className="my-6 flex items-center gap-4">

          <div className="h-px flex-1 bg-dark/20" />

          <span className="text-xs opacity-50">
            OR
          </span>

          <div className="h-px flex-1 bg-dark/20" />

        </div>


        {/* Passkey */}

        <button
          type="button"
          onClick={handlePasskeyLogin}
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


        {/* Security note */}

        <p className="mt-6 text-center text-xs opacity-50">
          Your admin account is protected by
          password authentication and additional
          security verification.
        </p>

      </div>
    </main>
  );
}