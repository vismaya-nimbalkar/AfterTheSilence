import { createAdminClient } from "@/src/lib/supabase/admin";
import { canManagePost } from "@/src/lib/admin/postAccess";
import { getUserRole, hasEditorPermission } from "@/src/lib/admin/permissions";

export async function canManagePostComments(user, postSlug) {
  if (!user || !hasEditorPermission(user, "posts")) {
    return false;
  }

  if (getUserRole(user) === "admin") {
    return true;
  }

  const supabaseAdmin = createAdminClient();
  const { data: post, error } = await supabaseAdmin
    .from("posts")
    .select("id")
    .eq("slug", postSlug)
    .maybeSingle();

  if (error) {
    console.error("Could not find post while checking comment access:", error);
    throw error;
  }

  return Boolean(post && await canManagePost(user, post.id, supabaseAdmin));
}
