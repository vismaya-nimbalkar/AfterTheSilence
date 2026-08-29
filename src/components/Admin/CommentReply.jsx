"use client";

import { useState } from "react";

export default function CommentReply({
  commentId,
  postSlug,
  onReply,
}) {
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cleanReply = reply.trim();

    if (!cleanReply) {
      setError("Please write a reply.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/comments/reply",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parentId: commentId,
            postSlug,
            comment: cleanReply,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Request failed with status ${response.status}.`
        );
      }

      setReply("");
      setOpen(false);

      if (onReply) {
        onReply(data.reply);
      }

    } catch (error) {
      console.error(
        "Could not create admin reply:",
        error
      );

      setError(
        error.message ||
          "Could not create reply."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">

      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError("");
          }}
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
          "
        >
          ↩ Reply
        </button>
      )}

      {open && (
        <form
          onSubmit={handleSubmit}
          className="
            mt-3
            rounded-xl
            border
            border-dark/10
            bg-dark/5
            p-4
          "
        >

          <div className="mb-3">

            <div className="flex items-center gap-2">

              <span className="text-sm font-semibold">
                Reply as Vismaya
              </span>

              <span
                className="
                  inline-flex
                  items-center
                  gap-1
                  rounded-full
                  bg-accent
                  px-2
                  py-0.5
                  text-xs
                  font-semibold
                  text-light
                "
              >
                ✓ Official
              </span>

            </div>

          </div>

          <textarea
            value={reply}
            onChange={(event) =>
              setReply(event.target.value)
            }
            rows={4}
            maxLength={5000}
            placeholder="Write your reply..."
            className="
              w-full
              resize-y
              rounded-xl
              border
              border-dark/20
              bg-transparent
              px-4
              py-3
              text-sm
              outline-none
              focus:border-dark
            "
          />

          {error && (
            <p
              className="
                mt-2
                text-sm
                text-red-600
              "
            >
              {error}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-3">

            <button
              type="submit"
              disabled={loading}
              className="
                rounded-lg
                bg-dark
                px-4
                py-2
                text-sm
                font-medium
                text-light
                transition-opacity
                hover:opacity-80
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {loading
                ? "Replying..."
                : "Post Official Reply"}
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReply("");
                setError("");
              }}
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
              "
            >
              Cancel
            </button>

          </div>

        </form>
      )}

    </div>
  );
}