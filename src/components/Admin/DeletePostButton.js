"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "./ConfirmDialog";

export default function DeletePostButton({ postId }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete post?",
      message: "This post will be permanently deleted and cannot be recovered.",
      confirmLabel: "Delete post",
    });

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
    <>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-lg border border-red-500/30 px-4 py-2 text-center text-sm font-medium text-red-600 whitespace-nowrap hover:bg-red-500/10 disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete"}
      </button>
      {dialog}
    </>
  );
}