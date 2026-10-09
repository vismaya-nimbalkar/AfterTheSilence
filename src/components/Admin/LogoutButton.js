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
        border-dark
        px-5
        py-3
        font-medium
        text-center
        whitespace-nowrap
        transition-opacity
        hover:opacity-70
        disabled:opacity-50
      "
    >
      {loading ? "Signing out..." : "Log Out"}
    </button>
  );
}