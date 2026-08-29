"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);

    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/admin/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="
        rounded-lg
        border
        border-dark/20
        px-4
        py-2
        text-sm
        font-medium
        transition-colors
        hover:bg-dark
        hover:text-light
        disabled:opacity-50
      "
    >
      {loading ? "Signing out..." : "Log Out"}
    </button>
  );
}