"use client";

import { useEffect, useRef, useState } from "react";

export default function PostAccessManager({
  postId,
  selectedEditorIds = [],
  onSelectionChange,
}) {
  const [editors, setEditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestQueues = useRef(new Map());

  const loadAccess = async () => {
    try {
      const endpoint = postId
        ? `/api/admin/posts/${postId}/access`
        : "/api/admin/editors";
      const response = await fetch(endpoint, {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load post access.");
      }

      setEditors(
        (result.editors || []).map((editor) => ({
          ...editor,
          assigned: postId
            ? editor.assigned
            : selectedEditorIds.includes(editor.user_id),
        }))
      );
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || "Could not load post access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
  }, [postId]);

  const toggleAccess = async (editor) => {
    setError("");
    const nextAssigned = !editor.assigned;

    setEditors((current) =>
      current.map((item) =>
        item.user_id === editor.user_id
          ? { ...item, assigned: nextAssigned }
          : item
      )
    );

    if (!postId) {
      const nextIds = nextAssigned
        ? [...selectedEditorIds, editor.user_id]
        : selectedEditorIds.filter((id) => id !== editor.user_id);
      onSelectionChange?.([...new Set(nextIds)]);
      return;
    }

    const previousRequest = requestQueues.current.get(editor.user_id) || Promise.resolve();
    const nextRequest = previousRequest
      .catch(() => {})
      .then(async () => {
        const response = await fetch(`/api/admin/posts/${postId}/access`, {
          method: nextAssigned ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editorUserId: editor.user_id }),
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not update post access.");
        }
      })
      .catch((saveError) => {
        console.error(saveError);
        setError(saveError.message || "Could not update post access.");
        setEditors((current) =>
          current.map((item) =>
            item.user_id === editor.user_id && item.assigned === nextAssigned
              ? { ...item, assigned: editor.assigned }
              : item
          )
        );
      });

    requestQueues.current.set(editor.user_id, nextRequest);

    nextRequest.finally(() => {
      if (requestQueues.current.get(editor.user_id) === nextRequest) {
        requestQueues.current.delete(editor.user_id);
      }
    });
  };

  return (
    <details className="mt-5 rounded-xl border border-dark/10 p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Add collaborators
      </summary>

      {loading ? (
        <p className="mt-3 text-sm opacity-60">Loading editor access...</p>
      ) : editors.length === 0 ? (
        <p className="mt-3 text-sm opacity-60">Create an editor account to share this post.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {editors.map((editor) => (
            <label
              key={editor.user_id}
              className="flex min-h-9 cursor-pointer select-none items-center gap-3 rounded-md px-1 text-sm"
            >
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 cursor-pointer"
                checked={editor.assigned}
                onChange={() => toggleAccess(editor)}
              />
              <span>
                {editor.name || editor.email}
                <span className="ml-2 opacity-60">{editor.email}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </details>
  );
}
