"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeletePostButton({ postId }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this post?"
    );

    if (!confirmed) return;

    setDeleting(true);

    const response = await fetch(`/api/admin/posts/${postId}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(result.error);
      alert(result.error || "Could not delete the post.");
      setDeleting(false);
      return;
    }

    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
    >
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}