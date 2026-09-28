import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";

export async function canManagePost(user, postId, supabaseAdmin = createAdminClient()) {
  if (!user) {
    return false;
  }

  if (getUserRole(user) === "admin") {
    return true;
  }

  const { data, error } = await supabaseAdmin
    .from("post_editor_access")
    .select("post_id")
    .eq("post_id", postId)
    .eq("editor_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Could not verify post access:", error);
    return false;
  }

  return Boolean(data);
}
