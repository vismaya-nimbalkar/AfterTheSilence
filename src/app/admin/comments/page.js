import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole, hasEditorPermission } from "@/src/lib/admin/permissions";
import CommentModeration from "@/src/components/Admin/CommentModeration";
import BannedIPs from "@/src/components/Admin/BannedIPs";
import BackLink from "@/src/components/BackLink";

export default async function AdminCommentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/forbidden");
  }

  const role = getUserRole(user);
  const isAdmin = role === "admin";
  if (!hasEditorPermission(user, "posts")) {
    redirect("/forbidden");
  }

  let commentsQuery = supabase
    .from("comments")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    const supabaseAdmin = createAdminClient();
    const { data: assignedPosts, error: assignmentsError } = await supabaseAdmin
      .from("post_editor_access")
      .select("post_id")
      .eq("editor_user_id", user.id);

    if (assignmentsError) {
      console.error("Could not load editor post assignments for comment moderation:", assignmentsError);
      throw new Error("Could not load your assigned posts.");
    }

    const postIds = (assignedPosts || []).map(({ post_id }) => post_id).filter(Boolean);
    let slugs = [];
    if (postIds.length > 0) {
      const { data: assignedPostsData, error: postsError } = await supabase
        .from("posts")
        .select("slug")
        .in("id", postIds);

      if (postsError) {
        console.error("Could not load assigned post slugs for comment moderation:", postsError);
        throw new Error("Could not load your assigned posts.");
      }

      slugs = (assignedPostsData || []).map(({ slug }) => slug).filter(Boolean);
    }

    commentsQuery = commentsQuery.in("post_slug", slugs.length ? slugs : ["__no_posts__"]);
  }

  const { data: comments, error: commentsError } = await commentsQuery;

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <BackLink href="/admin">Back to Dashboard</BackLink>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm opacity-60">After The Silence</p>
            <h1 className="mt-2 text-4xl font-bold">Comments</h1>
            <p className="mt-2 text-sm opacity-60">
              Review comments before they appear publicly.
            </p>
          </div>
          {!commentsError && (
            <div className="w-fit rounded-full border border-dark/20 px-4 py-2 text-sm font-medium">
              {comments.filter((comment) => comment.status === "pending").length} comments pending
            </div>
          )}
        </div>

        <section className="mt-10">
          {commentsError ? (
            <div className="rounded-2xl border border-red-500/30 p-6 text-red-600">
              <p className="font-medium">Could not load comments.</p>
              <p className="mt-2 text-sm opacity-80">{commentsError.message}</p>
            </div>
          ) : (
            <CommentModeration comments={comments || []} canModerateAll />
          )}
        </section>

        {isAdmin && <BannedIPs />}

      </div>
    </main>
  );
}
