import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/server";
import DeletePostButton from "@/src/components/Admin/DeletePostButton";
import LogoutButton from "@/src/components/Admin/LogoutButton";
import CommentModeration from "@/src/components/Admin/CommentModeration";
import BannedIPs from "@/src/components/Admin/BannedIPs";
import { getUserRole } from "@/src/lib/admin/permissions";
import { createAdminClient } from "@/src/lib/supabase/admin";

function AdminPostCard({ post }) {
  return (
    <div className="rounded-2xl border border-dark/20 p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-xl font-semibold">{post.title}</h3>
          <div className="mt-2 flex flex-wrap gap-3 text-sm opacity-60">
            <span>{post.is_published ? "Published" : "Draft"}</span>
            {post.author && <span>• {post.author}</span>}
            {(post.published_at || post.created_at) && (
              <span>• {new Date(post.published_at || post.created_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-nowrap gap-3 whitespace-nowrap">
          <Link
            href={`/admin/posts/${post.id}/edit`}
            className="rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-dark/5"
          >
            Edit
          </Link>
          <DeletePostButton postId={post.id} />
          <Link
            href={`/blogs/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-dark/5"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

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

  const role = getUserRole(user);
  const isAdmin = role === "admin";

  // ============================================================
  // GET POSTS
  // ============================================================

  let postsQuery = supabase
    .from("posts")
    .select("*")
    .order("published_at", {
      ascending: false,
      nullsFirst: false,
    });

  if (!isAdmin) {
    const supabaseAdmin = createAdminClient();
    const { data: assignedPosts } = await supabaseAdmin
      .from("post_editor_access")
      .select("post_id")
      .eq("editor_user_id", user.id);

    const assignedPostIds = (assignedPosts || [])
      .map((assignment) => assignment.post_id)
      .filter(Boolean);

    postsQuery = assignedPostIds.length
      ? postsQuery.in("id", assignedPostIds)
      : postsQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
  }

  const {
    data: posts,
    error: postsError,
  } = await postsQuery;

  // ============================================================
  // GET COMMENTS
  // ============================================================

  let commentsQuery = supabase
    .from("comments")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (!isAdmin) {
    const ownPosts = (posts || []).map((post) => post.slug).filter(Boolean);

    if (ownPosts.length === 0) {
      commentsQuery = commentsQuery.in("post_slug", ["__no_posts__"]);
    } else {
      commentsQuery = commentsQuery.in("post_slug", ownPosts);
    }
  }

  const {
    data: comments,
    error: commentsError,
  } = await commentsQuery;

  const pendingComments =
    comments?.filter(
      (comment) => comment.status === "pending"
    ) || [];

  const publishedPosts = (posts || []).filter((post) => post.is_published);
  const draftPosts = (posts || [])
    .filter((post) => !post.is_published)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

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
            gap-8
          "
        >

          <div>

            <p className="text-sm opacity-60">
              After The Silence
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              {isAdmin ? "Admin Dashboard" : "Editor Dashboard"}
            </h1>

            <p className="mt-2 text-sm opacity-60">
              Signed in as {user.email}
            </p>

          </div>


          {/* ====================================================
              HEADER ACTIONS
          ===================================================== */}

          <div className="flex w-full flex-wrap items-center gap-3 border-t border-dark/10 pt-6">

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
                whitespace-nowrap
              "
            >
              Security
            </Link>


            {/* Newsletter */}

            {isAdmin && (
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
                whitespace-nowrap
              "
              >
                Newsletter
              </Link>
            )}


            {/* Editors */}

            {isAdmin && (
              <Link
                href="/admin/editors"
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
                  whitespace-nowrap
                "
              >
                Editors
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin/travel"
                className="rounded-lg border border-dark px-5 py-3 text-center font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
              >
                Travel
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin/site-settings"
                className="rounded-lg border border-dark px-5 py-3 text-center font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
              >
                Site Settings
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin/forms"
                className="rounded-lg border border-dark px-5 py-3 text-center font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
              >
                Forms
              </Link>
            )}

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
                dark:bg-light
                dark:text-dark
                transition-opacity
                hover:opacity-80
                whitespace-nowrap
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
              canModerateAll
              role={role}
            />
          )}

        </section>


        {/* ======================================================
            BANNED COMMENTERS
        ======================================================= */}

        {isAdmin && <BannedIPs />}


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
              Published Posts
            </h2>

            <span className="text-sm opacity-60">
              {publishedPosts.length} total
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
            publishedPosts.length === 0 && (
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
                    dark:bg-light
                    dark:text-dark
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
            {publishedPosts.map((post) => <AdminPostCard key={post.id} post={post} />)}
          </div>

        </section>

        <section className="mt-20">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Drafts</h2>
            <span className="text-sm opacity-60">{draftPosts.length} total</span>
          </div>

          {draftPosts.length === 0 ? (
            <div className="rounded-2xl border border-dark/20 p-8 text-center text-sm opacity-60">
              No draft posts.
            </div>
          ) : (
            <div className="space-y-4">
              {draftPosts.map((post) => <AdminPostCard key={post.id} post={post} />)}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}