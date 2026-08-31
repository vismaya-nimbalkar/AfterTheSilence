"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { getUserRole } from "@/src/lib/admin/permissions";

export default function EditorsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [editors, setEditors] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!user || userError) {
          router.replace("/forbidden");
          return;
        }

        const role = getUserRole(user);
        const adminAccess = role === "admin";

        if (mounted) {
          setIsAdmin(adminAccess);
        }

        if (!adminAccess) {
          router.replace("/forbidden");
          return;
        }

        const response = await fetch("/api/admin/editors");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not load editor accounts.");
        }

        if (mounted) {
          setEditors(result.editors || []);
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setError(err?.message || "Could not load editor accounts.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const handleCreateEditor = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/editors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not create editor account.");
      }

      setMessage("Editor account created successfully.");
      setEmail("");
      setPassword("");
      setName("");

      setEditors((currentEditors) => [result.editor, ...currentEditors]);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not create editor account.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEditor = async (editor) => {
    if (!editor?.id || !window.confirm(`Delete the editor account for ${editor.email}?`)) {
      return;
    }

    setDeletingId(editor.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/editors", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: editor.id }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not delete editor account.");
      }

      setEditors((currentEditors) =>
        currentEditors.filter((item) => item.id !== editor.id)
      );
      setMessage("Editor account deleted.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not delete editor account.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="opacity-60">Loading editor management...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Access denied.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => router.push("/admin")}
          className="text-sm opacity-60 hover:opacity-100"
        >
          ← Back to Dashboard
        </button>

        <h1 className="mt-8 text-4xl font-bold">Editor Accounts</h1>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-700">
            {message}
          </div>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={handleCreateEditor} className="rounded-2xl border border-dark/20 p-6">
            <h2 className="text-2xl font-semibold">Create editor</h2>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Editor name"
                  className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="editor@example.com"
                  className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-dark px-5 py-3 font-medium text-light disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create editor account"}
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-dark/20 p-6">
            <h2 className="text-2xl font-semibold">Existing editors</h2>

            <div className="mt-6 space-y-3">
              {editors.length === 0 ? (
                <p className="text-sm opacity-60">No editor accounts yet.</p>
              ) : (
                editors.map((editor) => (
                  <div key={editor.id} className="rounded-xl border border-dark/20 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{editor.name || editor.email}</p>
                        <p className="mt-1 text-sm opacity-60">{editor.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEditor(editor)}
                        disabled={deletingId === editor.id}
                        className="text-sm text-red-600 hover:opacity-70 disabled:opacity-50"
                      >
                        {deletingId === editor.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
