import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { canManagePost } from "@/src/lib/admin/postAccess";
import { slugify } from "@/src/lib/forms";

async function getAuthorizedUser(postId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const supabaseAdmin = createAdminClient();
  const allowed = await canManagePost(user, postId, supabaseAdmin);

  if (!allowed) {
    return { response: NextResponse.json({ error: "You do not have access to this post." }, { status: 403 }) };
  }

  return { user, supabaseAdmin };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { response, supabaseAdmin } = await getAuthorizedUser(id);

    if (response) return response;

    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message || "Could not load post." }, { status: 500 });
    }

    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Post GET error:", error);
    return NextResponse.json({ error: error?.message || "Could not load post." }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { response, supabaseAdmin } = await getAuthorizedUser(id);

    if (response) return response;

    const body = await request.json();
    const lastEditedAt = body.last_edited_at || null;
    const { data: existingPost, error: existingPostError } = await supabaseAdmin
      .from("posts")
      .select("published_at")
      .eq("id", id)
      .single();

    if (existingPostError) {
      return NextResponse.json({ error: existingPostError.message || "Could not load post." }, { status: 500 });
    }

    const updateData = {
      title: body.title?.trim(),
      slug: slugify(body.slug),
      description: body.description?.trim(),
      content: body.content,
      author: body.author?.trim(),
      tags: Array.isArray(body.tags) ? body.tags : [],
      image_url: body.image_url || null,
      is_published: Boolean(body.is_published),
      last_edited_at: body.last_edited_at || null,
      updated_at: new Date().toISOString(),
    };

    if (!updateData.slug) {
      return NextResponse.json({ error: "A valid slug is required." }, { status: 400 });
    }

    if (lastEditedAt && !/^\d{4}-\d{2}-\d{2}$/.test(lastEditedAt)) {
      return NextResponse.json({ error: "Enter a valid last edited date." }, { status: 400 });
    }

    if (updateData.is_published && !existingPost.published_at) {
      updateData.published_at = new Date().toISOString();
    }

    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || "Could not save post." }, { status: 500 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Post PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Could not save post." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { response, supabaseAdmin } = await getAuthorizedUser(id);

    if (response) return response;

    const { error } = await supabaseAdmin.from("posts").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message || "Could not delete post." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Post DELETE error:", error);
    return NextResponse.json({ error: error?.message || "Could not delete post." }, { status: 500 });
  }
}
