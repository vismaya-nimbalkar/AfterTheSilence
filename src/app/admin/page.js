import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/server";
import DeletePostButton from "@/src/components/Admin/DeletePostButton";
import LogoutButton from "@/src/components/Admin/LogoutButton";
import CommentModeration from "@/src/components/Admin/CommentModeration";
import BannedIPs from "@/src/components/Admin/BannedIPs";

export default async function AdminPage() {
  const supabase = await createClient();

  // ============================================================
  // CHECK LOGIN
  // ============================================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → show forbidden page
  if (!user) {
    redirect("/forbidden");
  }

  // ============================================================
  // GET POSTS
  // ============================================================

  const {
    data: posts,
    error: postsError,
  } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  // ============================================================
  // GET COMMENTS
  // ============================================================

  const {
    data: comments,
    error: commentsError,
  } = await supabase
    .from("comments")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  const pendingComments =
    comments?.filter(
      (comment) => comment.status === "pending"
    ) || [];

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">

        {/* ======================================================
            HEADER
        ======================================================= */}

        <div
          className="
            flex
            flex-col
            gap-6
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div>

            <p className="text-sm opacity-60">
              After The Silence
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-sm opacity-60">
              Signed in as {user.email}
            </p>

          </div>


          {/* ====================================================
              HEADER ACTIONS
          ===================================================== */}

          <div className="flex flex-col gap-3 sm:flex-row">

            {/* Security */}

            <Link
              href="/admin/security"
              className="
                rounded-lg
                border
                border-dark
                px-5
                py-3
                text-center
                font-medium
                transition-opacity
                hover:opacity-70
              "
            >
              🔐 Security
            </Link>


            {/* Newsletter */}

            <Link
              href="/admin/newsletter"
              className="
                rounded-lg
                border
                border-dark
                px-5
                py-3
                text-center
                font-medium
                transition-opacity
                hover:opacity-70
              "
            >
              ✉ Newsletter
            </Link>


            {/* New Post */}

            <Link
              href="/admin/posts/new"
              className="
                rounded-lg
                bg-dark
                px-5
                py-3
                text-center
                font-medium
                text-light
                transition-opacity
                hover:opacity-80
              "
            >
              + New Post
            </Link>


            {/* Logout */}

            <LogoutButton />

          </div>

        </div>


        {/* ======================================================
            COMMENTS / MODERATION
        ======================================================= */}

        <section className="mt-16">

          <div
            className="
              mb-6
              flex
              flex-col
              gap-2
              sm:flex-row
              sm:items-end
              sm:justify-between
            "
          >

            <div>

              <h2 className="text-2xl font-semibold">
                Comments
              </h2>

              <p className="mt-1 text-sm opacity-60">
                Review comments before they appear publicly.
              </p>

            </div>


            {/* Pending count */}

            <div
              className="
                w-fit
                rounded-full
                border
                border-dark/20
                px-4
                py-2
                text-sm
                font-medium
              "
            >
              {pendingComments.length}{" "}
              {pendingComments.length === 1
                ? "comment"
                : "comments"}{" "}
              pending
            </div>

          </div>


          {/* ==================================================
              COMMENTS DATABASE ERROR
          =================================================== */}

          {commentsError && (
            <div
              className="
                rounded-2xl
                border
                border-red-500/30
                p-6
                text-red-600
              "
            >

              <p className="font-medium">
                Could not load comments.
              </p>

              <p className="mt-2 text-sm opacity-80">
                {commentsError.message}
              </p>

            </div>
          )}


          {/* ==================================================
              COMMENT MODERATION
          =================================================== */}

          {!commentsError && (
            <CommentModeration
              comments={comments || []}
            />
          )}

        </section>


        {/* ======================================================
            BANNED COMMENTERS
        ======================================================= */}

        <BannedIPs />


        {/* ======================================================
            POSTS
        ======================================================= */}

        <section className="mt-20">

          <div
            className="
              mb-6
              flex
              items-center
              justify-between
            "
          >

            <h2 className="text-2xl font-semibold">
              Posts
            </h2>

            <span className="text-sm opacity-60">
              {posts?.length || 0} total
            </span>

          </div>


          {/* ==================================================
              POSTS DATABASE ERROR
          =================================================== */}

          {postsError && (
            <div
              className="
                rounded-lg
                border
                border-red-500/30
                p-5
                text-red-600
              "
            >

              <p className="font-medium">
                Could not load posts.
              </p>

              <p className="mt-1 text-sm opacity-80">
                {postsError.message}
              </p>

            </div>
          )}


          {/* ==================================================
              NO POSTS
          =================================================== */}

          {!postsError &&
            (!posts || posts.length === 0) && (
              <div
                className="
                  rounded-2xl
                  border
                  border-dark/20
                  p-10
                  text-center
                "
              >

                <p className="text-lg font-medium">
                  No posts yet.
                </p>

                <p className="mt-2 opacity-60">
                  Create your first post to get started.
                </p>

                <Link
                  href="/admin/posts/new"
                  className="
                    mt-6
                    inline-block
                    rounded-lg
                    bg-dark
                    px-5
                    py-3
                    text-light
                    transition-opacity
                    hover:opacity-80
                  "
                >
                  Create Post
                </Link>

              </div>
            )}


          {/* ==================================================
              POST LIST
          =================================================== */}

          <div className="space-y-4">

            {posts?.map((post) => (

              <div
                key={post.id}
                className="
                  rounded-2xl
                  border
                  border-dark/20
                  p-6
                "
              >

                <div
                  className="
                    flex
                    flex-col
                    gap-5
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >

                  {/* ==================================================
                      POST INFORMATION
                  =================================================== */}

                  <div className="min-w-0">

                    <h3
                      className="
                        break-words
                        text-xl
                        font-semibold
                      "
                    >
                      {post.title}
                    </h3>

                    <div
                      className="
                        mt-2
                        flex
                        flex-wrap
                        gap-3
                        text-sm
                        opacity-60
                      "
                    >

                      <span>
                        {post.is_published
                          ? "Published"
                          : "Draft"}
                      </span>

                      {post.author && (
                        <span>
                          • {post.author}
                        </span>
                      )}

                      {post.created_at && (
                        <span>
                          •{" "}
                          {new Date(
                            post.created_at
                          ).toLocaleDateString()}
                        </span>
                      )}

                    </div>

                  </div>


                  {/* ==================================================
                      POST ACTIONS
                  =================================================== */}

                  <div
                    className="
                      flex
                      flex-wrap
                      gap-3
                    "
                  >

                    {/* Edit */}

                    <Link
                      href={`/admin/posts/${post.id}/edit`}
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
                      Edit
                    </Link>


                    {/* Delete */}

                    <DeletePostButton
                      postId={post.id}
                    />


                    {/* View */}

                    <Link
                      href={`/blogs/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
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
                      View
                    </Link>

                  </div>

                </div>

              </div>

            ))}

          </div>

        </section>

      </div>
    </main>
  );
}