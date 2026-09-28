import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || getUserRole(user) !== "admin") {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  return { user, supabaseAdmin: createAdminClient() };
}

export async function GET(request, { params }) {
  try {
    const { response, supabaseAdmin } = await requireAdmin();
    if (response) return response;

    const { id: postId } = await params;
    const [{ data: editors, error: editorsError }, { data: access, error: accessError }] =
      await Promise.all([
        supabaseAdmin
          .from("editor_accounts")
          .select("id, user_id, email, name")
          .order("name", { ascending: true }),
        supabaseAdmin
          .from("post_editor_access")
          .select("editor_user_id")
          .eq("post_id", postId),
      ]);

    if (editorsError || accessError) {
      return NextResponse.json(
        { error: editorsError?.message || accessError?.message || "Could not load post access." },
        { status: 500 }
      );
    }

    const assignedUserIds = new Set((access || []).map((item) => item.editor_user_id));
    return NextResponse.json({
      editors: (editors || []).map((editor) => ({
        ...editor,
        assigned: assignedUserIds.has(editor.user_id),
      })),
    });
  } catch (error) {
    console.error("Post access GET error:", error);
    return NextResponse.json({ error: error?.message || "Could not load post access." }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { response, user, supabaseAdmin } = await requireAdmin();
    if (response) return response;

    const { id: postId } = await params;
    const { editorUserId } = await request.json();

    if (!editorUserId) {
      return NextResponse.json({ error: "Editor account is required." }, { status: 400 });
    }

    const [{ data: editor }, { data: post }] = await Promise.all([
      supabaseAdmin.from("editor_accounts").select("user_id").eq("user_id", editorUserId).maybeSingle(),
      supabaseAdmin.from("posts").select("id").eq("id", postId).maybeSingle(),
    ]);

    if (!editor) return NextResponse.json({ error: "Editor account not found." }, { status: 404 });
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    const { error } = await supabaseAdmin.from("post_editor_access").upsert(
      { post_id: postId, editor_user_id: editorUserId, granted_by: user.id },
      { onConflict: "post_id,editor_user_id" }
    );

    if (error) return NextResponse.json({ error: error.message || "Could not grant post access." }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Post access POST error:", error);
    return NextResponse.json({ error: error?.message || "Could not grant post access." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { response, supabaseAdmin } = await requireAdmin();
    if (response) return response;

    const { id: postId } = await params;
    const { editorUserId } = await request.json();

    if (!editorUserId) {
      return NextResponse.json({ error: "Editor account is required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("post_editor_access")
      .delete()
      .eq("post_id", postId)
      .eq("editor_user_id", editorUserId);

    if (error) return NextResponse.json({ error: error.message || "Could not revoke post access." }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Post access DELETE error:", error);
    return NextResponse.json({ error: error?.message || "Could not revoke post access." }, { status: 500 });
  }
}
