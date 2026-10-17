import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { canManagePostComments } from "@/src/lib/admin/commentAccess";
import { hasEditorPermission } from "@/src/lib/admin/permissions";

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !hasEditorPermission(user, "posts")) {
      return NextResponse.json(
        { error: user ? "You do not have permission to manage post comments." : "Unauthorized." },
        { status: user ? 403 : 401 }
      );
    }

    const postSlug = new URL(request.url).searchParams.get("slug")?.trim();
    if (!postSlug) {
      return NextResponse.json({ error: "Post slug is required." }, { status: 400 });
    }

    if (!await canManagePostComments(user, postSlug)) {
      return NextResponse.json(
        { error: "You do not have permission to manage comments for this post." },
        { status: 403 }
      );
    }

    const { data: comments, error } = await createAdminClient()
      .from("comments")
      .select("id, post_slug, parent_id, name, email, comment, created_at, status, is_admin, ip_hash")
      .eq("post_slug", postSlug)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Could not load comments for post moderation:", error);
      return NextResponse.json({ error: "Could not load comments." }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (error) {
    console.error("Admin post comments GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load comments." },
      { status: 500 }
    );
  }
}
