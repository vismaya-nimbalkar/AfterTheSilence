"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/src/lib/supabase/client";
import { getUserRole } from "@/src/lib/admin/permissions";

export default function AdminSecurityPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  // ============================================================
  // AUTH
  // ============================================================

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  // ============================================================
  // MFA / TOTP
  // ============================================================

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [showMFASetup, setShowMFASetup] = useState(false);

  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaMessage, setMfaMessage] = useState("");

  // ============================================================
  // PASSKEYS
  // ============================================================

  const [passkeys, setPasskeys] = useState([]);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState("");

  // ============================================================
  // LOAD PASSKEYS
  // ============================================================

  const loadPasskeys = async () => {
    try {
      const {
        data,
        error: passkeyError,
      } = await supabase.auth.passkey.list();

      if (passkeyError) {
        console.error(
          "Could not load passkeys:",
          passkeyError
        );
        return;
      }

      setPasskeys(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Could not load passkeys:",
        error
      );
    }
  };

  // ============================================================
  // INITIAL AUTH CHECK
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) {
            router.replace("/forbidden");
          }
          return;
        }

        if (!mounted) {
          return;
        }

        setAuthorized(true);
        setIsAdmin(getUserRole(user) === "admin");

        // ======================================================
        // LOAD MFA FACTORS
        // ======================================================

        const {
          data: factors,
          error: factorsError,
        } = await supabase.auth.mfa.listFactors();

        if (factorsError) {
          throw factorsError;
        }

        const verifiedTotp =
          factors?.totp?.filter(
            (factor) =>
              factor.status === "verified"
          ) || [];

        if (verifiedTotp.length > 0) {
          setMfaEnabled(true);
          setMfaFactorId(
            verifiedTotp[0].id
          );
        } else {
          setMfaEnabled(false);
          setMfaFactorId("");
        }

        // ======================================================
        // LOAD PASSKEYS
        // ======================================================

        await loadPasskeys();

      } catch (error) {
        console.error(
          "Security page error:",
          error
        );

        if (mounted) {
          if (
            error?.name ===
              "AuthSessionMissingError" ||
            error?.message ===
              "Auth session missing!"
          ) {
            router.replace(
              "/forbidden"
            );
            return;
          }

          setError(
            error?.message ||
              "Could not load security settings."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================

  const changePassword = async (event) => {
    event.preventDefault();

    setError("");
    setPasswordMessage("");

    if (!newPassword) {
      setError(
        "Please enter a new password."
      );
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "Your new password must be at least 8 characters long."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        "The passwords do not match."
      );
      return;
    }

    setPasswordLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/forbidden");
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        throw updateError;
      }

      setNewPassword("");
      setConfirmPassword("");

      setPasswordMessage(
        "Your password has been changed. Please sign in again with your new password."
      );

      /*
       * Sign out all local authentication state
       * after changing the password.
       *
       * The user will therefore have to go through
       * the normal login + MFA flow again.
       */
      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/admin/login");
      }, 1500);

    } catch (error) {
      console.error(
        "Password change error:",
        error
      );

      if (
        error?.name ===
          "AuthSessionMissingError" ||
        error?.message ===
          "Auth session missing!"
      ) {
        router.replace(
          "/forbidden"
        );
        return;
      }

      setError(
        error?.message ||
          "Could not change your password."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  // ============================================================
  // START MFA SETUP
  // ============================================================

  const startMFASetup = async () => {
    setError("");
    setMfaMessage("");
    setMfaLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/forbidden");
        return;
      }

      const {
        data: factors,
        error: factorsError,
      } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        throw factorsError;
      }

      const verifiedTotp =
        factors?.totp?.filter(
          (factor) =>
            factor.status === "verified"
        ) || [];

      if (verifiedTotp.length > 0) {
        setMfaEnabled(true);
        setMfaFactorId(
          verifiedTotp[0].id
        );

        setMfaMessage(
          "Two-factor authentication is already enabled."
        );

        return;
      }

      const unverifiedTotp =
        factors?.totp?.filter(
          (factor) =>
            factor.status === "unverified"
        ) || [];

      for (const factor of unverifiedTotp) {
        const {
          error: unenrollError,
        } =
          await supabase.auth.mfa.unenroll({
            factorId: factor.id,
          });

        if (unenrollError) {
          console.warn(
            "Could not remove old unverified MFA factor:",
            unenrollError
          );
        }
      }

      const friendlyName = isAdmin
        ? "After The Silence Admin"
        : "After The Silence Editor";

      let enrollment = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });

      if (
        enrollment.error?.message?.includes(
          "friendly name"
        )
      ) {
        enrollment = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `${friendlyName} ${Date.now()}`,
        });
      }

      const { data, error } = enrollment;

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error(
          "Supabase did not return an MFA factor ID."
        );
      }

      setMfaFactorId(data.id);

      setQrCode(
        data.totp?.qr_code?.trimEnd() || ""
      );

      setSecret(
        data.totp?.secret || ""
      );

      setMfaCode("");
      setShowMFASetup(true);

    } catch (error) {
      console.error(
        "MFA enrollment error:",
        error
      );

      if (
        error?.name ===
          "AuthSessionMissingError" ||
        error?.message ===
          "Auth session missing!"
      ) {
        router.replace(
          "/forbidden"
        );
        return;
      }

      setError(
        error?.message ||
          "Could not start two-factor authentication."
      );
    } finally {
      setMfaLoading(false);
    }
  };

  // ============================================================
  // VERIFY MFA
  // ============================================================

  const verifyMFA = async (event) => {
    event.preventDefault();

    setError("");
    setMfaMessage("");

    if (!mfaFactorId) {
      setError(
        "No MFA factor was found."
      );
      return;
    }

    if (!/^\d{6}$/.test(mfaCode)) {
      setError(
        "Enter the 6-digit code from your authenticator app."
      );
      return;
    }

    setMfaLoading(true);

    try {
      const {
        data: challenge,
        error: challengeError,
      } =
        await supabase.auth.mfa.challenge({
          factorId: mfaFactorId,
        });

      if (challengeError) {
        throw challengeError;
      }

      if (!challenge?.id) {
        throw new Error(
          "Supabase did not return an MFA challenge."
        );
      }

      const {
        error: verifyError,
      } =
        await supabase.auth.mfa.verify({
          factorId: mfaFactorId,
          challengeId: challenge.id,
          code: mfaCode,
        });

      if (verifyError) {
        throw verifyError;
      }

      setMfaEnabled(true);
      setShowMFASetup(false);

      setMfaCode("");
      setQrCode("");
      setSecret("");

      setMfaMessage(
        "Two-factor authentication is now enabled."
      );

    } catch (error) {
      console.error(
        "MFA verification error:",
        error
      );

      if (
        error?.name ===
          "AuthSessionMissingError" ||
        error?.message ===
          "Auth session missing!"
      ) {
        router.replace(
          "/forbidden"
        );
        return;
      }

      setError(
        error?.message ||
          "The verification code was incorrect."
      );

      setMfaCode("");

    } finally {
      setMfaLoading(false);
    }
  };

  // ============================================================
  // CANCEL MFA SETUP
  // ============================================================

  const cancelMFASetup = async () => {
    if (mfaFactorId) {
      try {
        await supabase.auth.mfa.unenroll({
          factorId: mfaFactorId,
        });
      } catch (error) {
        console.warn(
          "Could not cancel MFA enrollment:",
          error
        );
      }
    }

    setShowMFASetup(false);
    setMfaFactorId("");
    setQrCode("");
    setSecret("");
    setMfaCode("");
    setMfaMessage("");
    setError("");
  };

  // ============================================================
  // DISABLE MFA
  // ============================================================

  const disableMFA = async () => {
    if (!mfaFactorId) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to disable two-factor authentication?"
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setMfaMessage("");
    setMfaLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/forbidden");
        return;
      }

      const {
        error,
      } =
        await supabase.auth.mfa.unenroll({
          factorId: mfaFactorId,
        });

      if (error) {
        throw error;
      }

      setMfaEnabled(false);
      setMfaFactorId("");

      setMfaMessage(
        "Two-factor authentication has been disabled."
      );

    } catch (error) {
      console.error(
        "Disable MFA error:",
        error
      );

      if (
        error?.name ===
          "AuthSessionMissingError" ||
        error?.message ===
          "Auth session missing!"
      ) {
        router.replace(
          "/forbidden"
        );
        return;
      }

      setError(
        error?.message ||
          "Could not disable two-factor authentication."
      );

    } finally {
      setMfaLoading(false);
    }
  };

  // ============================================================
  // REGISTER PASSKEY
  // ============================================================

  const registerPasskey = async () => {
    setError("");
    setPasskeyMessage("");
    setPasskeyLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/forbidden");
        return;
      }

      const {
        data,
        error,
      } =
        await supabase.auth.registerPasskey();

      if (error) {
        throw error;
      }

      console.log(
        "Passkey registration successful:",
        data
      );

      setPasskeyMessage(
        "Passkey added successfully."
      );

      await loadPasskeys();

    } catch (error) {
      console.error(
        "Passkey registration error:",
        error
      );

      if (
        error?.name ===
          "AuthSessionMissingError" ||
        error?.message ===
          "Auth session missing!"
      ) {
        router.replace(
          "/forbidden"
        );
        return;
      }

      setError(
        error?.message ||
          "Could not register your passkey."
      );

    } finally {
      setPasskeyLoading(false);
    }
  };

  // ============================================================
  // DELETE PASSKEY
  // ============================================================

  const deletePasskey = async (
    passkeyId
  ) => {
    if (!passkeyId) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to remove this passkey?"
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setPasskeyMessage("");
    setPasskeyLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/forbidden");
        return;
      }

      const {
        error,
      } =
        await supabase.auth.passkey.delete(
          passkeyId
        );

      if (error) {
        throw error;
      }

      await loadPasskeys();

      setPasskeyMessage(
        "Passkey removed."
      );

    } catch (error) {
      console.error(
        "Passkey deletion error:",
        error
      );

      if (
        error?.name ===
          "AuthSessionMissingError" ||
        error?.message ===
          "Auth session missing!"
      ) {
        router.replace(
          "/forbidden"
        );
        return;
      }

      setError(
        error?.message ||
          "Could not remove passkey."
      );

    } finally {
      setPasskeyLoading(false);
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm opacity-60">
            {isAdmin
              ? "Checking admin access..."
              : "Checking account access..."}
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // NOT AUTHORIZED
  // ============================================================

  if (!authorized) {
    return null;
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-3xl">

        {/* HEADER */}

        <div className="mb-12">

          <button
            type="button"
            onClick={() =>
              router.push("/admin")
            }
            className="
              mb-6
              text-sm
              opacity-60
              transition-opacity
              hover:opacity-100
            "
          >
            ← Back to {isAdmin ? "Admin" : "Editor"}
          </button>

          <p className="text-sm opacity-60">
            After The Silence
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Security
          </h1>

          <p className="mt-3 max-w-xl text-sm opacity-60">
            Manage your password, two-factor
            authentication, and passkeys for
            your {isAdmin ? "admin" : "editor"} account.
          </p>

        </div>

        {/* ERROR */}

        {error && (
          <div
            className="
              mb-8
              rounded-xl
              border
              border-red-500/30
              bg-red-500/5
              px-5
              py-4
              text-sm
              text-red-600
            "
          >
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {(mfaMessage ||
          passkeyMessage ||
          passwordMessage) && (
          <div
            className="
              mb-8
              rounded-xl
              border
              border-green-500/30
              bg-green-500/5
              px-5
              py-4
              text-sm
              text-green-700
            "
          >
            {passwordMessage ||
              mfaMessage ||
              passkeyMessage}
          </div>
        )}

        {/* ====================================================
            CHANGE PASSWORD
        ===================================================== */}

        <section
          className="
            rounded-2xl
            border
            border-dark/20
            p-6
            sm:p-8
          "
        >

          <div>

            <h2 className="text-2xl font-semibold">
              Change password
            </h2>

            <p className="mt-2 text-sm leading-6 opacity-60">
              Choose a new password for your
              {isAdmin ? "admin" : "editor"} account. You will be signed
              out after changing it and will need
              to sign in again.
            </p>

          </div>

          <form
            onSubmit={changePassword}
            className="mt-6 space-y-5"
          >

            {/* NEW PASSWORD */}

            <div>

              <label
                htmlFor="new-password"
                className="
                  mb-2
                  block
                  text-sm
                  font-medium
                "
              >
                New password
              </label>

              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(
                    event.target.value
                  )
                }
                autoComplete="new-password"
                minLength={8}
                required
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
                placeholder="Enter a new password"
              />

              <p className="mt-2 text-xs opacity-50">
                Must be at least 8 characters.
              </p>

            </div>

            {/* CONFIRM PASSWORD */}

            <div>

              <label
                htmlFor="confirm-password"
                className="
                  mb-2
                  block
                  text-sm
                  font-medium
                "
              >
                Confirm new password
              </label>

              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                autoComplete="new-password"
                minLength={8}
                required
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
                placeholder="Enter the password again"
              />

            </div>

            {/* CHANGE PASSWORD BUTTON */}

            <button
              type="submit"
              disabled={
                passwordLoading ||
                !newPassword ||
                !confirmPassword
              }
              className="
                w-full
                rounded-xl
                bg-dark
                px-5
                py-4
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
              {passwordLoading
                ? "Changing password..."
                : "Change password"}
            </button>

          </form>

        </section>

        {/* ====================================================
            TWO FACTOR AUTHENTICATION
        ===================================================== */}

        <section
          className="
            mt-8
            rounded-2xl
            border
            border-dark/20
            p-6
            sm:p-8
          "
        >

          <div className="flex flex-col gap-6">

            <div>

              <div className="flex flex-wrap items-center gap-3">

                <h2 className="text-2xl font-semibold">
                  Two-factor authentication
                </h2>

                {mfaEnabled && (
                  <span
                    className="
                      rounded-full
                      bg-green-500/10
                      px-3
                      py-1
                      text-xs
                      font-medium
                      text-green-700
                    "
                  >
                    Enabled
                  </span>
                )}

              </div>

              <p className="mt-2 text-sm leading-6 opacity-60">
                Protect your {isAdmin ? "admin" : "editor"} account with
                a six-digit code from an
                authenticator app.
              </p>

            </div>

            {/* MFA ENABLED */}

            {mfaEnabled && (
              <div
                className="
                  rounded-xl
                  border
                  border-green-500/20
                  bg-green-500/5
                  p-5
                "
              >

                <p className="font-medium">
                  ✓ Authenticator app connected
                </p>

                <p className="mt-1 text-sm opacity-60">
                  Your account has a verified
                  authenticator factor.
                </p>

                <button
                  type="button"
                  onClick={disableMFA}
                  disabled={mfaLoading}
                  className="
                    mt-5
                    rounded-lg
                    border
                    border-red-500/30
                    px-4
                    py-2
                    text-sm
                    font-medium
                    text-red-600
                    transition-colors
                    hover:bg-red-500/5
                    disabled:opacity-50
                  "
                >
                  {mfaLoading
                    ? "Working..."
                    : "Disable 2FA"}
                </button>

              </div>
            )}

            {/* MFA NOT ENABLED */}

            {!mfaEnabled &&
              !showMFASetup && (
                <button
                  type="button"
                  onClick={startMFASetup}
                  disabled={mfaLoading}
                  className="
                    w-full
                    rounded-xl
                    bg-dark
                    px-5
                    py-4
                    font-medium
                    text-light
                    dark:bg-light
                    dark:text-dark
                    transition-opacity
                    hover:opacity-80
                    disabled:opacity-50
                  "
                >
                  {mfaLoading
                    ? "Preparing..."
                    : "Set up authenticator app"}
                </button>
              )}

            {/* MFA SETUP */}

            {showMFASetup && (
              <div
                className="
                  rounded-2xl
                  border
                  border-dark/10
                  bg-dark/5
                  p-6
                "
              >

                <h3 className="text-lg font-semibold">
                  Set up your authenticator
                </h3>

                <p className="mt-2 text-sm leading-6 opacity-60">
                  Scan this QR code using
                  your authenticator app.
                </p>

                {/* QR CODE */}

                {qrCode && (
                  <div className="mt-6 flex justify-center">

                    <div className="rounded-xl bg-white p-4">

                      <Image
                        src={qrCode}
                        alt="Authenticator QR code"
                        width={220}
                        height={220}
                        unoptimized
                      />

                    </div>

                  </div>
                )}

                {/* SECRET FALLBACK */}

                {secret && (
                  <details className="mt-6">

                    <summary
                      className="
                        cursor-pointer
                        text-sm
                        font-medium
                      "
                    >
                      Can't scan the QR code?
                    </summary>

                    <div className="mt-3">

                      <p className="text-xs opacity-60">
                        Enter this secret manually
                        into your authenticator app:
                      </p>

                      <code
                        className="
                          mt-2
                          block
                          break-all
                          rounded-lg
                          border
                          border-dark/20
                          bg-white
                          p-3
                          text-xs
                        "
                      >
                        {secret}
                      </code>

                    </div>

                  </details>
                )}

                {/* VERIFY FORM */}

                <form
                  onSubmit={verifyMFA}
                  className="mt-8 space-y-4"
                >

                  <div>

                    <label
                      htmlFor="mfa-code"
                      className="
                        mb-2
                        block
                        text-sm
                        font-medium
                      "
                    >
                      Enter the 6-digit code
                    </label>

                    <input
                      id="mfa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(event) =>
                        setMfaCode(
                          event.target.value.replace(
                            /\D/g,
                            ""
                          )
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

                  <button
                    type="submit"
                    disabled={
                      mfaLoading ||
                      mfaCode.length !== 6
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
                    {mfaLoading
                      ? "Verifying..."
                      : "Verify & Enable 2FA"}
                  </button>

                </form>

                {/* CANCEL */}

                <button
                  type="button"
                  onClick={
                    cancelMFASetup
                  }
                  disabled={mfaLoading}
                  className="
                    mt-3
                    w-full
                    rounded-lg
                    border
                    border-dark/20
                    px-4
                    py-3
                    text-sm
                    font-medium
                    transition-colors
                    hover:bg-dark/5
                    disabled:opacity-50
                  "
                >
                  Cancel setup
                </button>

              </div>
            )}

          </div>

        </section>

        {/* ====================================================
            PASSKEYS
        ===================================================== */}

        <section
          className="
            mt-8
            rounded-2xl
            border
            border-dark/20
            p-6
            sm:p-8
          "
        >

          <div>

            <h2 className="text-2xl font-semibold">
              Passkeys
            </h2>

            <p className="mt-2 text-sm leading-6 opacity-60">
              Sign in using Face ID, Touch ID,
              your device PIN, Windows Hello,
              or a compatible security key.
            </p>

          </div>

          {/* ADD PASSKEY */}

          <button
            type="button"
            onClick={registerPasskey}
            disabled={passkeyLoading}
            className="
              mt-6
              w-full
              rounded-xl
              border
              border-dark/30
              px-5
              py-4
              font-medium
              transition-colors
              hover:bg-dark/5
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {passkeyLoading
              ? "Waiting for passkey..."
              : "Add a passkey"}
          </button>

          {/* EXISTING PASSKEYS */}

          {passkeys.length > 0 && (
            <div className="mt-8">

              <h3 className="text-sm font-semibold">
                Registered passkeys
              </h3>

              <div className="mt-3 space-y-3">

                {passkeys.map(
                  (passkey) => (
                    <div
                      key={passkey.id}
                      className="
                        flex
                        flex-col
                        gap-3
                        rounded-xl
                        border
                        border-dark/10
                        p-4
                        sm:flex-row
                        sm:items-center
                        sm:justify-between
                      "
                    >

                      <div>

                        <p className="font-medium">
                          {passkey.friendly_name ||
                            "Passkey"}
                        </p>

                        {passkey.created_at && (
                          <p className="mt-1 text-xs opacity-50">
                            Added{" "}
                            {new Date(
                              passkey.created_at
                            ).toLocaleDateString()}
                          </p>
                        )}

                        {passkey.last_used_at && (
                          <p className="mt-1 text-xs opacity-50">
                            Last used{" "}
                            {new Date(
                              passkey.last_used_at
                            ).toLocaleDateString()}
                          </p>
                        )}

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          deletePasskey(
                            passkey.id
                          )
                        }
                        disabled={
                          passkeyLoading
                        }
                        className="
                          rounded-lg
                          border
                          border-red-500/30
                          px-4
                          py-2
                          text-sm
                          font-medium
                          text-red-600
                          transition-colors
                          hover:bg-red-500/5
                          disabled:opacity-50
                        "
                      >
                        Remove
                      </button>

                    </div>
                  )
                )}

              </div>

            </div>
          )}

          {/* NO PASSKEYS */}

          {passkeys.length === 0 && (
            <p className="mt-6 text-sm opacity-50">
              No passkeys registered yet.
            </p>
          )}

        </section>

        {/* ====================================================
            SECURITY NOTE
        ===================================================== */}

        <div
          className="
            mt-8
            rounded-xl
            border
            border-dark/10
            p-5
          "
        >

          <p className="text-sm font-medium">
            Security recommendation
          </p>

          <p className="mt-2 text-sm leading-6 opacity-60">
            Keep at least two authentication
            methods available. A passkey and an
            authenticator app provide useful
            backup options if one becomes
            unavailable.
          </p>

        </div>

      </div>
    </main>
  );
}