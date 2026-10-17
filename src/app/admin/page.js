import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/server";
import DeletePostButton from "@/src/components/Admin/DeletePostButton";
import LogoutButton from "@/src/components/Admin/LogoutButton";
import {
  canManageStaffAccounts,
  getUserRole,
  hasEditorPermission,
} from "@/src/lib/admin/permissions";
import { createAdminClient } from "@/src/lib/supabase/admin";

function AdminPostCard({ post }) {
  return (
    <div className="rounded-2xl border border-dark/20 p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-xl font-semibold">{post.title}</h3>
          <div className="mt-2 flex flex-wrap gap-3 text-sm opacity-60">
            <span>{post.is_published ? "Published" : "Draft"}</span>
            {post.author && <span>{post.author}</span>}
            {(post.published_at || post.created_at) && (
              <span>
                {new Date(post.published_at || post.created_at).toLocaleDateString()}
              </span>
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

  if (!user) {
    redirect("/forbidden");
  }

  const role = getUserRole(user);
  const isAdmin = role === "admin";
  const canManageStaff = canManageStaffAccounts(user);
  const canManagePosts = hasEditorPermission(user, "posts");
  const canManageTravel = hasEditorPermission(user, "travel");
  const canManageShop = hasEditorPermission(user, "shop");

  // ============================================================
  // GET POSTS
  // ============================================================

  let posts = [];
  let postsError = null;
  if (canManagePosts) {
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

    const result = await postsQuery;
    posts = result.data || [];
    postsError = result.error;
  }

  const publishedPosts = (posts || []).filter((post) => post.is_published);
  const draftPosts = (posts || [])
    .filter((post) => !post.is_published)
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <div className="flex flex-col gap-8">
          <div>
            <p className="text-sm opacity-60">After The Silence</p>
            <h1 className="mt-2 text-4xl font-bold">
              {isAdmin ? "Admin Dashboard" : "Editor Dashboard"}
            </h1>
            <p className="mt-2 text-sm opacity-60">Signed in as {user.email}</p>
          </div>

          {/* HEADER ACTIONS */}
          <div className="flex w-full flex-wrap items-center gap-3 border-t border-dark/10 pt-6">
            <Link
              href="/admin/security"
              className="rounded-lg border border-dark px-5 py-3 text-center font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
            >
              Security
            </Link>

            {isAdmin && (
              <Link
                href="/admin/newsletter"
                className="rounded-lg border border-dark px-5 py-3 text-center font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
              >
                Newsletter
              </Link>
            )}

            {canManageStaff && (
              <Link
                href="/admin/editors"
                className="rounded-lg border border-dark px-5 py-3 text-center font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
              >
                Accounts
              </Link>
            )}

            {canManagePosts && (
              <Link
                href="/admin/comments"
                className="rounded-lg border border-dark px-5 py-3 text-center font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
              >
                Comments
              </Link>
            )}

            {(isAdmin || canManageTravel) && (
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

            {/* Shop Management */}
            {(isAdmin || canManageShop) && (
              <Link
                href="/admin/shop"
                className="rounded-lg border border-dark px-5 py-3 text-center font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
              >
                Shop
              </Link>
            )}

            {/* Orders Management */}
            {(isAdmin || canManageShop) && (
              <Link
                href="/admin/orders"
                className="rounded-lg border border-dark px-5 py-3 text-center font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
              >
                Orders
              </Link>
            )}

            {/* New Post */}
            {canManagePosts && <Link
              href="/admin/posts/new"
              className="rounded-lg bg-dark px-5 py-3 text-center font-medium text-light dark:bg-light dark:text-dark transition-opacity hover:opacity-80 whitespace-nowrap"
            >
              + New Post
            </Link>}

            <LogoutButton />
          </div>
        </div>

        {/* POSTS */}
        {canManagePosts && <section className="mt-20">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Published Posts</h2>
            <span className="text-sm opacity-60">
              {publishedPosts.length} total
            </span>
          </div>

          {postsError && (
            <div className="rounded-lg border border-red-500/30 p-5 text-red-600">
              <p className="font-medium">Could not load posts.</p>
              <p className="mt-1 text-sm opacity-80">{postsError.message}</p>
            </div>
          )}

          {!postsError && publishedPosts.length === 0 && (
            <div className="rounded-2xl border border-dark/20 p-10 text-center">
              <p className="text-lg font-medium">No posts yet.</p>
              <p className="mt-2 opacity-60">
                Create your first post to get started.
              </p>
              <Link
                href="/admin/posts/new"
                className="mt-6 inline-block rounded-lg bg-dark px-5 py-3 text-light dark:bg-light dark:text-dark transition-opacity hover:opacity-80"
              >
                Create Post
              </Link>
            </div>
          )}

          <div className="space-y-4">
            {publishedPosts.map((post) => (
              <AdminPostCard key={post.id} post={post} />
            ))}
          </div>
        </section>}

        {canManagePosts && <section className="mt-20">
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
              {draftPosts.map((post) => (
                <AdminPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>}
      </div>
    </main>
  );
}