import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

export async function POST(request) {
  try {
    // ============================================================
    // VERIFY LOGGED-IN USER
    // ============================================================

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    // ============================================================
    // GET REQUEST DATA
    // ============================================================

    const body = await request.json();

    const {
      parentId,
      postSlug,
      comment,
    } = body;

    if (
      !parentId ||
      !postSlug ||
      !comment?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required information.",
        },
        {
          status: 400,
        }
      );
    }

    // ============================================================
    // PRIVILEGED SERVER CLIENT
    // ============================================================

    const supabaseAdmin =
      createAdminClient();

    // ============================================================
    // VERIFY PARENT COMMENT
    // ============================================================

    const {
      data: parentComment,
      error: parentError,
    } = await supabaseAdmin
      .from("comments")
      .select(
        "id, post_slug, parent_id"
      )
      .eq("id", parentId)
      .maybeSingle();

    if (parentError) {
      console.error(
        "Parent comment lookup failed:",
        parentError
      );

      return NextResponse.json(
        {
          error:
            parentError.message ||
            "Could not find the original comment.",
        },
        {
          status: 500,
        }
      );
    }

    if (!parentComment) {
      return NextResponse.json(
        {
          error:
            "Original comment not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ============================================================
    // VERIFY POST
    // ============================================================

    if (
      parentComment.post_slug !==
      postSlug
    ) {
      return NextResponse.json(
        {
          error: "Invalid post.",
        },
        {
          status: 400,
        }
      );
    }

    // ============================================================
    // DON'T ALLOW NESTED ADMIN REPLIES
    // ============================================================

    if (parentComment.parent_id) {
      return NextResponse.json(
        {
          error:
            "You can only reply to an original comment.",
        },
        {
          status: 400,
        }
      );
    }

    // ============================================================
    // INSERT OFFICIAL REPLY
    // ============================================================

    const {
      data: reply,
      error: insertError,
    } = await supabaseAdmin
      .from("comments")
      .insert({
        post_slug: postSlug,
        parent_id: parentId,
        name: "Vismaya Nimbalkar",
        email: null,
        comment: comment.trim(),
        status: "approved",
        is_admin: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error(
        "ADMIN REPLY INSERT FAILED:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            insertError.message ||
            "Could not create reply.",
        },
        {
          status: 500,
        }
      );
    }

    // ============================================================
    // SUCCESS
    // ============================================================

    return NextResponse.json(
      {
        success: true,
        reply,
      },
      {
        status: 201,
      }
    );

  } catch (error) {
    console.error(
      "ADMIN REPLY ROUTE FAILED:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong.",
      },
      {
        status: 500,
      }
    );
  }
}