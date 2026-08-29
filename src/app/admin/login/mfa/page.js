"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

export default function AdminMFAPage() {
  const router = useRouter();

  const [supabase] = useState(() =>
    createClient()
  );

  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    const loadMFA = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/admin/login");
          return;
        }

        const { data, error } =
          await supabase.auth.mfa.listFactors();

        if (error) {
          throw error;
        }

        /*
         * We only want verified TOTP factors.
         */
        const verifiedFactors =
          data?.totp?.filter(
            (factor) =>
              factor.status === "verified"
          ) || [];

        if (verifiedFactors.length === 0) {
          /*
           * No MFA is actually configured.
           * Send them to the admin dashboard.
           */
          router.replace("/admin");
          return;
        }

        /*
         * For your single-admin setup,
         * use the first verified authenticator.
         */
        setFactorId(
          verifiedFactors[0].id
        );

      } catch (error) {
        console.error(
          "Could not load MFA:",
          error
        );

        setError(
          error?.message ||
            "Could not load two-factor authentication."
        );
      } finally {
        setLoading(false);
      }
    };

    loadMFA();
  }, [router, supabase]);


  const handleVerify = async (event) => {
    event.preventDefault();

    setError("");

    if (!factorId) {
      setError(
        "No authenticator factor was found."
      );
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError(
        "Please enter the 6-digit code from your authenticator app."
      );
      return;
    }

    setVerifying(true);

    try {
      /*
       * Create a fresh challenge.
       */
      const {
        data: challenge,
        error: challengeError,
      } =
        await supabase.auth.mfa.challenge({
          factorId,
        });

      if (challengeError) {
        throw challengeError;
      }

      /*
       * Verify the authenticator code.
       */
      const { error: verifyError } =
        await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code,
        });

      if (verifyError) {
        throw verifyError;
      }

      /*
       * MFA is now complete.
       * The session should be at AAL2.
       */
      const {
        data: assurance,
        error: assuranceError,
      } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceError) {
        throw assuranceError;
      }

      if (
        assurance.currentLevel !== "aal2"
      ) {
        throw new Error(
          "Two-factor authentication could not be completed."
        );
      }

      router.replace("/admin");
      router.refresh();

    } catch (error) {
      console.error(
        "MFA verification error:",
        error
      );

      setError(
        error?.message ||
          "Incorrect verification code."
      );

      setCode("");
      setVerifying(false);
    }
  };


  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">

        <p className="text-sm opacity-60">
          Checking security...
        </p>

      </main>
    );
  }


  return (
    <main className="min-h-screen flex items-center justify-center px-6">

      <div className="w-full max-w-md">

        <div className="text-center mb-10">

          <div className="text-4xl mb-4">
          </div>

          <h1 className="text-3xl font-bold">
            Two-Factor Authentication
          </h1>

          <p className="mt-3 text-sm opacity-60">
            Enter the 6-digit code from your
            authenticator app.
          </p>

        </div>


        <form
          onSubmit={handleVerify}
          className="space-y-6"
        >

          <div>

            <label
              htmlFor="mfa-code"
              className="block text-sm font-medium mb-2"
            >
              Authentication code
            </label>

            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value
                    .replace(/\D/g, "")
                )
              }
              autoFocus
              className="
                w-full
                rounded-lg
                border
                border-dark/30
                bg-transparent
                px-4
                py-4
                text-center
                text-2xl
                tracking-[0.5em]
                outline-none
                focus:border-dark
              "
              placeholder="000000"
            />

          </div>


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
              verifying ||
              code.length !== 6
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
            {verifying
              ? "Verifying..."
              : "Verify & Continue"}
          </button>


          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/admin/login");
            }}
            className="
              w-full
              text-sm
              opacity-60
              transition-opacity
              hover:opacity-100
            "
          >
            Cancel and sign out
          </button>

        </form>

      </div>

    </main>
  );
}