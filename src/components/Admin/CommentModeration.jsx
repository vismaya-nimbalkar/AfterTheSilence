"use client";

import { useState } from "react";
import CommentReply from "./CommentReply";

export default function CommentModeration({
  comments: initialComments = [],
}) {
  const [comments, setComments] =
    useState(initialComments);

  const [loadingId, setLoadingId] =
    useState(null);

  const [actionError, setActionError] =
    useState("");

  const [editingId, setEditingId] =
    useState(null);

  const [editingText, setEditingText] =
    useState("");

  // ============================================================
  // UPDATE COMMENT STATUS
  // ============================================================

  const updateComment = async (id, action) => {
    if (!id) {
      setActionError(
        "This comment does not have a valid ID."
      );
      return;
    }

    setLoadingId(id);
    setActionError("");

    try {
      const safeId = encodeURIComponent(
        String(id)
      );

      const response = await fetch(
        `/api/admin/comments/${safeId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
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

      setComments((current) =>
        current.map((comment) =>
          String(comment.id) === String(id)
            ? {
                ...comment,
                status: result.status,
              }
            : comment
        )
      );
    } catch (error) {
      console.error(
        "Comment moderation error:",
        error
      );

      setActionError(
        error?.message ||
          "Could not update the comment."
      );
    } finally {
      setLoadingId(null);
    }
  };

  // ============================================================
  // DELETE COMMENT
  // ============================================================

  const deleteComment = async (id) => {
    if (!id) {
      setActionError(
        "This comment does not have a valid ID."
      );
      return;
    }

    const confirmed = window.confirm(
      "Permanently delete this comment?"
    );

    if (!confirmed) {
      return;
    }

    setLoadingId(id);
    setActionError("");

    try {
      const safeId = encodeURIComponent(
        String(id)
      );

      const response = await fetch(
        `/api/admin/comments/${safeId}`,
        {
          method: "DELETE",
        }
      );

      const result =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Delete failed with status ${response.status}.`
        );
      }

      setComments((current) =>
        current.filter(
          (comment) =>
            String(comment.id) !== String(id)
        )
      );
    } catch (error) {
      console.error(
        "Comment deletion error:",
        error
      );

      setActionError(
        error?.message ||
          "Could not delete the comment."
      );
    } finally {
      setLoadingId(null);
    }
  };

  // ============================================================
  // BAN COMMENTER
  // ============================================================

  const banCommenter = async (comment) => {
    if (!comment?.id) {
      setActionError(
        "This comment does not have a valid ID."
      );
      return;
    }

    const confirmed = window.confirm(
      "Ban this commenter?\n\nTheir email and/or IP hash will be added to the ban list, and this comment will be rejected."
    );

    if (!confirmed) {
      return;
    }

    setLoadingId(comment.id);
    setActionError("");

    try {
      const safeId = encodeURIComponent(
        String(comment.id)
      );

      const response = await fetch(
        `/api/admin/comments/${safeId}/ban`,
        {
          method: "POST",
        }
      );

      const result =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Ban failed with status ${response.status}.`
        );
      }

      setComments((current) =>
        current.map((item) =>
          String(item.id) ===
          String(comment.id)
            ? {
                ...item,
                status: "rejected",
              }
            : item
        )
      );
    } catch (error) {
      console.error(
        "Comment ban error:",
        error
      );

      setActionError(
        error?.message ||
          "Could not ban the commenter."
      );
    } finally {
      setLoadingId(null);
    }
  };

  // ============================================================
  // HANDLE NEW ADMIN REPLY
  // ============================================================

  const addReplyToComments = (reply) => {
    if (!reply?.id) {
      return;
    }

    setComments((current) => [
      ...current,
      reply,
    ]);
  };

  // ============================================================
  // START EDITING ADMIN REPLY
  // ============================================================

  const startEditing = (comment) => {
    setEditingId(comment.id);
    setEditingText(comment.comment || "");
    setActionError("");
  };

  // ============================================================
  // CANCEL EDITING
  // ============================================================

  const cancelEditing = () => {
    setEditingId(null);
    setEditingText("");
  };

  // ============================================================
  // SAVE EDITED ADMIN REPLY
  // ============================================================

  const saveEdit = async (comment) => {
    if (!editingText.trim()) {
      setActionError(
        "Your reply cannot be empty."
      );
      return;
    }

    setLoadingId(comment.id);
    setActionError("");

    try {
      const safeId = encodeURIComponent(
        String(comment.id)
      );

      const response = await fetch(
        `/api/admin/comments/${safeId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "edit",
            comment: editingText.trim(),
          }),
        }
      );

      const result =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Edit failed with status ${response.status}.`
        );
      }

      setComments((current) =>
        current.map((item) =>
          String(item.id) ===
          String(comment.id)
            ? {
                ...item,
                comment:
                  result.comment ??
                  editingText.trim(),
              }
            : item
        )
      );

      cancelEditing();
    } catch (error) {
      console.error(
        "Admin reply edit error:",
        error
      );

      setActionError(
        error?.message ||
          "Could not edit the reply."
      );
    } finally {
      setLoadingId(null);
    }
  };

  // ============================================================
  // SPLIT COMMENTS
  // ============================================================

  const pendingComments =
    comments.filter(
      (comment) =>
        comment.status === "pending" &&
        !comment.parent_id
    );

  const moderatedComments =
    comments.filter(
      (comment) =>
        comment.status !== "pending" &&
        !comment.parent_id
    );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-10">

      {/* ======================================================
          ERROR
      ======================================================= */}

      {actionError && (
        <div
          className="
            rounded-xl
            border
            border-red-500/30
            bg-red-500/10
            px-5
            py-4
            text-sm
            text-red-700
            dark:text-red-300
          "
        >
          <p className="font-medium">
            Something went wrong
          </p>

          <p className="mt-1 opacity-80">
            {actionError}
          </p>
        </div>
      )}

      {/* ======================================================
          PENDING COMMENTS
      ======================================================= */}

      <div>

        <div className="mb-5 flex items-center justify-between">

          <h3 className="text-lg font-semibold">
            Pending Review
          </h3>

          <span className="text-sm opacity-60">
            {pendingComments.length}
          </span>

        </div>

        {pendingComments.length === 0 ? (
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
              ✨ Nothing waiting for review.
            </p>

            <p className="mt-2 text-sm opacity-60">
              You're all caught up.
            </p>
          </div>
        ) : (
          <div className="space-y-4">

            {pendingComments.map(
              (comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  loading={
                    loadingId === comment.id
                  }
                  editingId={editingId}
                  editingText={editingText}
                  setEditingText={
                    setEditingText
                  }
                  onApprove={() =>
                    updateComment(
                      comment.id,
                      "approve"
                    )
                  }
                  onReject={() =>
                    updateComment(
                      comment.id,
                      "reject"
                    )
                  }
                  onBan={() =>
                    banCommenter(comment)
                  }
                  onDelete={() =>
                    deleteComment(comment.id)
                  }
                  onReply={
                    addReplyToComments
                  }
                  onEdit={() =>
                    startEditing(comment)
                  }
                  onSaveEdit={() =>
                    saveEdit(comment)
                  }
                  onCancelEdit={
                    cancelEditing
                  }
                />
              )
            )}

          </div>
        )}

      </div>

      {/* ======================================================
          MODERATED COMMENTS
      ======================================================= */}

      {moderatedComments.length > 0 && (
        <details>

          <summary className="cursor-pointer text-lg font-semibold">
            Previously Moderated (
            {moderatedComments.length})
          </summary>

          <div className="mt-5 space-y-4">

            {moderatedComments.map(
              (comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  loading={
                    loadingId === comment.id
                  }
                  editingId={editingId}
                  editingText={editingText}
                  setEditingText={
                    setEditingText
                  }
                  onApprove={() =>
                    updateComment(
                      comment.id,
                      "approve"
                    )
                  }
                  onReject={() =>
                    updateComment(
                      comment.id,
                      "reject"
                    )
                  }
                  onBan={() =>
                    banCommenter(comment)
                  }
                  onDelete={() =>
                    deleteComment(comment.id)
                  }
                  onReply={
                    addReplyToComments
                  }
                  onEdit={() =>
                    startEditing(comment)
                  }
                  onSaveEdit={() =>
                    saveEdit(comment)
                  }
                  onCancelEdit={
                    cancelEditing
                  }
                />
              )
            )}

          </div>

        </details>
      )}

    </div>
  );
}


// ============================================================
// COMMENT CARD
// ============================================================

function CommentCard({
  comment,
  loading,
  editingId,
  editingText,
  setEditingText,
  onApprove,
  onReject,
  onBan,
  onDelete,
  onReply,
  onEdit,
  onSaveEdit,
  onCancelEdit,
}) {
  const isEditing =
    editingId === comment.id;

  return (
    <article
      className="
        rounded-2xl
        border
        border-dark/20
        p-6
      "
    >

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

        <div>

          <div className="flex flex-wrap items-center gap-2">

            <h4 className="font-semibold">
              {comment.name ||
                "Anonymous"}
            </h4>

            {/* Official badge */}

            {comment.is_admin && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-1
                  rounded-full
                  bg-accent
                  px-2
                  py-1
                  text-xs
                  font-semibold
                  text-light
                "
              >
                ✓ Official
              </span>
            )}

            <span
              className="
                rounded-full
                border
                border-dark/20
                px-2
                py-1
                text-xs
                capitalize
              "
            >
              {comment.status}
            </span>

          </div>

          {comment.email && (
            <p className="mt-1 text-sm opacity-60">
              {comment.email}
            </p>
          )}

          {comment.created_at && (
            <p className="mt-1 text-xs opacity-50">
              {new Date(
                comment.created_at
              ).toLocaleString()}
            </p>
          )}

        </div>

      </div>


      {/* ======================================================
          COMMENT BODY / EDITOR
      ======================================================= */}

      {isEditing ? (

        <div className="mt-5">

          <textarea
            value={editingText}
            onChange={(event) =>
              setEditingText(
                event.target.value
              )
            }
            rows={5}
            maxLength={5000}
            autoFocus
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
              leading-7
              outline-none
              focus:border-dark
              dark:border-light/20
              dark:focus:border-light
            "
          />

          <div className="mt-3 flex flex-wrap gap-3">

            <button
              type="button"
              onClick={() =>
                onSaveEdit()
              }
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
                ? "Saving..."
                : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={onCancelEdit}
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
                hover:bg-dark/5
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              Cancel
            </button>

          </div>

        </div>

      ) : (

        <div
          className="
            mt-5
            rounded-xl
            bg-dark/5
            p-4
            dark:bg-light/5
          "
        >
          <p className="whitespace-pre-wrap text-sm leading-7">
            {comment.comment}
          </p>
        </div>

      )}


      {/* ======================================================
          ACTIONS
      ======================================================= */}

      {!isEditing && (
        <div className="mt-5 flex flex-wrap gap-3">

          {/* Approve */}

          {!comment.is_admin &&
            comment.status !==
              "approved" && (
              <button
                type="button"
                onClick={onApprove}
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
                  ? "Working..."
                  : "Approve"}
              </button>
            )}


          {/* Reject */}

          {!comment.is_admin &&
            comment.status !==
              "rejected" && (
              <button
                type="button"
                onClick={onReject}
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
                  hover:bg-dark/5
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                Reject
              </button>
            )}


          {/* Ban */}

          {!comment.is_admin && (
            <button
              type="button"
              onClick={onBan}
              disabled={loading}
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
                hover:bg-red-500/10
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              Ban Commenter
            </button>
          )}


          {/* ==================================================
              EDIT ADMIN REPLY
          =================================================== */}

          {comment.is_admin && (
            <button
              type="button"
              onClick={onEdit}
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
                hover:bg-dark/5
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              Edit Reply
            </button>
          )}


          {/* Delete */}

          <button
            type="button"
            onClick={onDelete}
            disabled={loading}
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
              hover:bg-red-500/10
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            Delete
          </button>


          {/* Reply */}

          {comment.status ===
            "approved" &&
            !comment.is_admin && (
              <CommentReply
                commentId={comment.id}
                postSlug={
                  comment.post_slug
                }
                onReply={
                  onReply
                }
              />
            )}

        </div>
      )}

    </article>
  );
}