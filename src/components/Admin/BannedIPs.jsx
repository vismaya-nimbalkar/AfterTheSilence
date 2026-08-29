"use client";

import { useEffect, useState } from "react";

export default function BannedIPs() {
  const [bannedUsers, setBannedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unbanningId, setUnbanningId] = useState(null);
  const [error, setError] = useState("");

  // ==========================================================
  // LOAD BANNED COMMENTERS
  // ==========================================================

  const loadBannedUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/banned-ips",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Request failed with status ${response.status}.`
        );
      }

      setBannedUsers(
        Array.isArray(result.bannedUsers)
          ? result.bannedUsers
          : []
      );
    } catch (error) {
      console.error(
        "Could not load banned commenters:",
        error
      );

      setError(
        error?.message ||
          "Could not load banned commenters."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBannedUsers();
  }, []);

  // ==========================================================
  // UNBAN
  // ==========================================================

  const handleUnban = async (ban) => {
    if (!ban?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Unban this commenter?\n\nThey will be allowed to submit comments again."
    );

    if (!confirmed) {
      return;
    }

    setUnbanningId(ban.id);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/banned-ips",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: ban.id,
          }),
        }
      );

      const result =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Request failed with status ${response.status}.`
        );
      }

      // Remove immediately from the UI
      setBannedUsers((current) =>
        current.filter(
          (item) => item.id !== ban.id
        )
      );
    } catch (error) {
      console.error(
        "Could not unban commenter:",
        error
      );

      setError(
        error?.message ||
          "Could not unban commenter."
      );
    } finally {
      setUnbanningId(null);
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <section className="mt-16">

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div
        className="
          mb-6
          flex
          flex-col
          gap-2
          sm:flex-row
          sm:items-end
          sm:justify-between
        "
      >

        <div>

          <h2 className="text-2xl font-semibold">
            Banned Commenters
          </h2>

          <p className="mt-1 text-sm opacity-60">
            People currently blocked from
            submitting comments.
          </p>

        </div>

        <span className="text-sm opacity-60">
          {bannedUsers.length} banned
        </span>

      </div>


      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (
        <div
          className="
            mb-5
            rounded-xl
            border
            border-red-500/30
            bg-red-500/10
            px-5
            py-4
            text-sm
            text-red-600
          "
        >
          {error}
        </div>
      )}


      {/* ======================================================
          LOADING
      ======================================================= */}

      {loading ? (
        <div
          className="
            rounded-2xl
            border
            border-dark/20
            p-8
            text-center
          "
        >
          <p className="text-sm opacity-60">
            Loading banned commenters...
          </p>
        </div>
      ) : bannedUsers.length === 0 ? (

        /* ====================================================
           EMPTY STATE
        ===================================================== */

        <div
          className="
            rounded-2xl
            border
            border-dark/20
            p-8
            text-center
          "
        >

          <p className="font-medium">
            No banned commenters.
          </p>

          <p className="mt-2 text-sm opacity-60">
            Anyone you ban will appear here.
          </p>

        </div>

      ) : (

        /* ====================================================
           BANNED USERS
        ===================================================== */

        <div className="space-y-3">

          {bannedUsers.map((ban) => (

            <div
              key={ban.id}
              className="
                rounded-2xl
                border
                border-dark/20
                p-5
              "
            >

              <div
                className="
                  flex
                  flex-col
                  gap-4
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >

                {/* Information */}

                <div>

                  <p className="font-medium">
                    🚫 Banned commenter
                  </p>

                  {ban.email && (
                    <p className="mt-1 text-sm opacity-60">
                      {ban.email}
                    </p>
                  )}

                  {ban.created_at && (
                    <p className="mt-1 text-xs opacity-50">
                      Banned on{" "}
                      {new Date(
                        ban.created_at
                      ).toLocaleString()}
                    </p>
                  )}

                </div>


                {/* Unban */}

                <button
                  type="button"
                  onClick={() =>
                    handleUnban(ban)
                  }
                  disabled={
                    unbanningId === ban.id
                  }
                  className="
                    rounded-lg
                    border
                    border-dark/20
                    px-4
                    py-2
                    text-sm
                    font-medium
                    transition-colors
                    hover:bg-dark/5
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {unbanningId === ban.id
                    ? "Unbanning..."
                    : "Unban"}
                </button>

              </div>

            </div>

          ))}

        </div>

      )}

    </section>
  );
}