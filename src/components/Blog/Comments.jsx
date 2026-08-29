"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";

export default function Comments({ slug }) {
  const [comments, setComments] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ============================================================
  // LOAD APPROVED COMMENTS
  // ============================================================

  useEffect(() => {
    if (!slug) return;

    const loadComments = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("comments")
        .select(
          "id, name, comment, created_at, parent_id, is_admin"
        )
        .eq("post_slug", slug)
        .eq("status", "approved")
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Could not load comments:",
          error
        );
      } else {
        setComments(data || []);
      }

      setLoadingComments(false);
    };

    loadComments();
  }, [slug]);

  // ============================================================
  // SUBMIT COMMENT
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/comments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug,
            name,
            email,
            comment,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Something went wrong. Please try again."
        );

        setLoading(false);
        return;
      }

      setName("");
      setEmail("");
      setComment("");

      setMessage(
        "Your comment has been submitted and is awaiting moderation. Thank you!"
      );
    } catch (error) {
      console.error(
        "Comment submission failed:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );
    }

    setLoading(false);
  };

  // ============================================================
  // BUILD COMMENT THREADS
  // ============================================================

  const topLevelComments = comments.filter(
    (item) => !item.parent_id
  );

  const getReplies = (commentId) => {
    return comments.filter(
      (item) =>
        item.parent_id === commentId
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <section
      className="
        col-span-12
        lg:col-start-5
        lg:col-span-8
        mt-16
        px-5
        md:px-10
        lg:px-0
      "
    >
      <div className="w-full">

        {/* ======================================================
            HEADER
        ======================================================= */}

        <div className="mb-10">

          <h2 className="text-2xl font-bold sm:text-3xl">
            Comments
          </h2>

          <p className="mt-2 text-sm opacity-60">
            Share your thoughts. Comments are reviewed before
            appearing publicly.
          </p>

        </div>


        {/* ======================================================
            EXISTING APPROVED COMMENTS
        ======================================================= */}

        {!loadingComments &&
          comments.length > 0 && (

            <div className="mb-14 space-y-6">

              {topLevelComments.map(
                (item) => {

                  const replies =
                    getReplies(item.id);

                  return (
                    <article
                      key={item.id}
                      className="
                        overflow-hidden
                        rounded-2xl
                        border
                        border-dark/10
                        dark:border-light/10
                      "
                    >

                      {/* ==================================================
                          ORIGINAL COMMENT
                      =================================================== */}

                      <div className="p-6 sm:p-8">

                        <div className="flex flex-col gap-1">

                          <div className="flex flex-wrap items-center gap-2">

                            <span className="font-semibold">
                              {item.name ||
                                "Anonymous"}
                            </span>

                            {item.is_admin && (
                              <span
                                className="
                                  inline-flex
                                  items-center
                                  gap-1
                                  rounded-full
                                  bg-accent
                                  px-2.5
                                  py-1
                                  text-xs
                                  font-semibold
                                  text-light
                                  dark:bg-accentDark
                                  dark:text-dark
                                "
                              >
                                <span
                                  className="
                                    flex
                                    h-4
                                    w-4
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-light
                                    text-[10px]
                                    font-bold
                                    text-accent
                                    dark:bg-dark
                                    dark:text-accentDark
                                  "
                                >
                                  ✓
                                </span>

                                Author
                              </span>
                            )}

                          </div>

                          <time className="text-xs opacity-50">
                            {new Date(
                              item.created_at
                            ).toLocaleDateString(
                              "en-US",
                              {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </time>

                        </div>

                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 opacity-80 sm:text-base">
                          {item.comment}
                        </p>

                      </div>


                      {/* ==================================================
                          REPLIES / THREAD
                      =================================================== */}

                      {replies.length > 0 && (

                        <div
                          className="
                            border-t
                            border-dark/10
                            bg-dark/[0.025]
                            px-6
                            py-5
                            dark:border-light/10
                            dark:bg-light/[0.025]
                            sm:px-8
                          "
                        >

                          <div className="space-y-5">

                            {replies.map(
                              (reply) => (

                                <div
                                  key={reply.id}
                                  className="
                                    ml-4
                                    border-l-2
                                    border-accent
                                    pl-5
                                    sm:ml-8
                                  "
                                >

                                  <div className="flex flex-col gap-1">

                                    <div className="flex flex-wrap items-center gap-2">

                                      <span className="font-semibold">
                                        {reply.name ||
                                          "Anonymous"}
                                      </span>

                                      {reply.is_admin && (
                                        <span
                                          className="
                                            inline-flex
                                            items-center
                                            gap-1
                                            rounded-full
                                            bg-accent
                                            px-2.5
                                            py-1
                                            text-xs
                                            font-semibold
                                            text-light
                                            dark:bg-accentDark
                                            dark:text-dark
                                          "
                                        >
                                          <span
                                            className="
                                              flex
                                              h-4
                                              w-4
                                              items-center
                                              justify-center
                                              rounded-full
                                              bg-light
                                              text-[10px]
                                              font-bold
                                              text-accent
                                              dark:bg-dark
                                              dark:text-accentDark
                                            "
                                          >
                                            ✓
                                          </span>

                                          Author
                                        </span>
                                      )}

                                    </div>

                                    <time className="text-xs opacity-50">
                                      {new Date(
                                        reply.created_at
                                      ).toLocaleDateString(
                                        "en-US",
                                        {
                                          month: "long",
                                          day: "numeric",
                                          year: "numeric",
                                        }
                                      )}
                                    </time>

                                  </div>

                                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 opacity-80 sm:text-base">
                                    {reply.comment}
                                  </p>

                                </div>

                              )
                            )}

                          </div>

                        </div>

                      )}

                    </article>
                  );
                }
              )}

            </div>
          )}


        {/* ======================================================
            NO COMMENTS
        ======================================================= */}

        {!loadingComments &&
          comments.length === 0 && (

            <p className="mb-10 text-sm opacity-50">
              No comments yet. Be the first to leave one.
            </p>

          )}


        {/* ======================================================
            COMMENT FORM
        ======================================================= */}

        <div
          className="
            rounded-2xl
            border
            border-dark/10
            dark:border-light/10
            p-6
            sm:p-8
          "
        >

          <h3 className="text-xl font-semibold">
            Leave a comment
          </h3>

          <p className="mt-2 text-sm opacity-60">
            Name and email are optional. Your email will never
            be displayed publicly.
          </p>


          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >

            {/* ==================================================
                NAME
            =================================================== */}

            <div>

              <label
                htmlFor="comment-name"
                className="mb-2 block text-sm font-medium"
              >
                Name

                <span className="ml-2 opacity-50">
                  (optional)
                </span>
              </label>

              <input
                id="comment-name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                maxLength={100}
                placeholder="Your name"
                className="
                  w-full
                  rounded-xl
                  border
                  border-dark/20
                  bg-transparent
                  px-4
                  py-3
                  outline-none
                  focus:border-dark
                  dark:border-light/20
                  dark:focus:border-light
                "
              />

            </div>


            {/* ==================================================
                EMAIL
            =================================================== */}

            <div>

              <label
                htmlFor="comment-email"
                className="mb-2 block text-sm font-medium"
              >
                Email

                <span className="ml-2 opacity-50">
                  (optional — never displayed)
                </span>
              </label>

              <input
                id="comment-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                maxLength={320}
                placeholder="you@example.com"
                autoComplete="email"
                className="
                  w-full
                  rounded-xl
                  border
                  border-dark/20
                  bg-transparent
                  px-4
                  py-3
                  outline-none
                  focus:border-dark
                  dark:border-light/20
                  dark:focus:border-light
                "
              />

            </div>


            {/* ==================================================
                COMMENT
            =================================================== */}

            <div>

              <label
                htmlFor="comment-body"
                className="mb-2 block text-sm font-medium"
              >
                Comment
              </label>

              <textarea
                id="comment-body"
                value={comment}
                onChange={(event) =>
                  setComment(event.target.value)
                }
                maxLength={5000}
                rows={6}
                required
                placeholder="Write your comment..."
                className="
                  w-full
                  resize-y
                  rounded-xl
                  border
                  border-dark/20
                  bg-transparent
                  px-4
                  py-3
                  outline-none
                  focus:border-dark
                  dark:border-light/20
                  dark:focus:border-light
                "
              />

              <p className="mt-2 text-right text-xs opacity-40">
                {comment.length}/5000
              </p>

            </div>


            {/* ==================================================
                SUCCESS
            =================================================== */}

            {message && (
              <div
                className="
                  rounded-xl
                  border
                  border-green-500/30
                  bg-green-500/10
                  px-4
                  py-3
                  text-sm
                  text-green-700
                  dark:text-green-300
                "
              >
                {message}
              </div>
            )}


            {/* ==================================================
                ERROR
            =================================================== */}

            {error && (
              <div
                className="
                  rounded-xl
                  border
                  border-red-500/30
                  bg-red-500/10
                  px-4
                  py-3
                  text-sm
                  text-red-700
                  dark:text-red-300
                "
              >
                {error}
              </div>
            )}


            {/* ==================================================
                SUBMIT
            =================================================== */}

            <button
              type="submit"
              disabled={loading}
              className="
                rounded-xl
                bg-dark
                px-6
                py-3
                font-medium
                text-light
                transition-opacity
                hover:opacity-80
                disabled:cursor-not-allowed
                disabled:opacity-50
                dark:bg-light
                dark:text-dark
              "
            >
              {loading
                ? "Submitting..."
                : "Submit Comment"}
            </button>

          </form>

        </div>

      </div>
    </section>
  );
}