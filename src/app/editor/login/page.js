"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { getUserRole } from "@/src/lib/admin/permissions";

export default function EditorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError || !data.user) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }

    if (getUserRole(data.user) !== "editor") {
      await supabase.auth.signOut();
      setError("This is the admin login. Please use the administrator sign-in page.");
      setLoading(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleLogin} className="w-full max-w-md space-y-5">
        <div>
          <p className="text-sm opacity-60">After The Silence</p>
          <h1 className="mt-2 text-3xl font-bold">Editor sign in</h1>
        </div>

        {error && <p className="rounded-lg border border-red-500/30 p-4 text-red-600">{error}</p>}

        <label className="block text-sm font-medium">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
            required
          />
        </label>

        <label className="block text-sm font-medium">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3 outline-none"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-dark px-5 py-3 font-medium text-light disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in as editor"}
        </button>
      </form>
    </main>
  );
}