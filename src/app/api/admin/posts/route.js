import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";
import { slugify } from "@/src/lib/forms";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !["admin", "editor"].includes(getUserRole(user))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const title = body.title?.trim();
    const slug = slugify(body.slug);

    if (!title || !slug || !body.content?.trim()) {
      return NextResponse.json(
        { error: "Title, slug, and content are required." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: post, error: insertError } = await supabaseAdmin
      .from("posts")
      .insert({
        title,
        slug,
        description: body.description?.trim() || "",
        content: body.content,
        author: body.author?.trim() || user.email,
        tags: Array.isArray(body.tags) ? body.tags : [],
        image_url: body.image_url || null,
        is_published: Boolean(body.is_published),
        published_at: body.is_published ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "Could not create the post.", code: insertError.code },
        { status: 500 }
      );
    }

    if (getUserRole(user) === "editor") {
      const { error: accessError } = await supabaseAdmin
        .from("post_editor_access")
        .insert({
          post_id: post.id,
          editor_user_id: user.id,
        });

      if (accessError) {
        await supabaseAdmin.from("posts").delete().eq("id", post.id);
        return NextResponse.json(
          { error: accessError.message || "Could not assign the post to the editor." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Post creation error:", error);
    return NextResponse.json(
      { error: error?.message || "Could not create the post." },
      { status: 500 }
    );
  }
}
