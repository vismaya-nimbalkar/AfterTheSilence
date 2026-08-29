import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

// ============================================================
// PATCH COMMENT
//
// Supports:
//   approve
//   reject
//   edit
// ============================================================

export async function PATCH(request, { params }) {
  try {
    // ==========================================================
    // CHECK THAT ADMIN IS LOGGED IN
    // ==========================================================

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================================
    // GET COMMENT ID
    // ==========================================================

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Comment ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // GET REQUEST BODY
    // ==========================================================

    const body = await request.json();

    const action = body?.action;

    // ==========================================================
    // CREATE ADMIN CLIENT
    //
    // Uses SUPABASE_SERVICE_ROLE_KEY.
    // This bypasses RLS.
    // ==========================================================

    const supabaseAdmin =
      createAdminClient();

    // ==========================================================
    // APPROVE / REJECT
    // ==========================================================

    if (
      action === "approve" ||
      action === "reject"
    ) {
      const status =
        action === "approve"
          ? "approved"
          : "rejected";

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("comments")
        .update({
          status,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error(
          "Supabase comment moderation error:",
          error
        );

        return NextResponse.json(
          {
            error:
              error.message ||
              "Could not update comment.",
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        status: data.status,
        comment: data,
      });
    }

    // ==========================================================
    // EDIT ADMIN REPLY
    // ==========================================================

    if (action === "edit") {
      const newComment =
        body?.comment?.trim();

      if (!newComment) {
        return NextResponse.json(
          {
            error:
              "Reply cannot be empty.",
          },
          {
            status: 400,
          }
        );
      }

      if (newComment.length > 5000) {
        return NextResponse.json(
          {
            error:
              "Reply cannot exceed 5000 characters.",
          },
          {
            status: 400,
          }
        );
      }

      // --------------------------------------------------------
      // MAKE SURE THIS IS ACTUALLY AN ADMIN REPLY
      // --------------------------------------------------------

      const {
        data: existingComment,
        error: lookupError,
      } = await supabaseAdmin
        .from("comments")
        .select(
          "id, is_admin, parent_id"
        )
        .eq("id", id)
        .maybeSingle();

      if (lookupError) {
        console.error(
          "Could not verify admin reply:",
          lookupError
        );

        return NextResponse.json(
          {
            error:
              lookupError.message ||
              "Could not verify reply.",
          },
          {
            status: 500,
          }
        );
      }

      if (!existingComment) {
        return NextResponse.json(
          {
            error:
              "Comment not found.",
          },
          {
            status: 404,
          }
        );
      }

      // --------------------------------------------------------
      // ONLY ADMIN REPLIES CAN BE EDITED
      // --------------------------------------------------------

      if (!existingComment.is_admin) {
        return NextResponse.json(
          {
            error:
              "Only official admin replies can be edited.",
          },
          {
            status: 403,
          }
        );
      }

      // --------------------------------------------------------
      // UPDATE REPLY
      // --------------------------------------------------------

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("comments")
        .update({
          comment: newComment,
          status: "approved",
          is_admin: true,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error(
          "Supabase admin reply edit error:",
          error
        );

        return NextResponse.json(
          {
            error:
              error.message ||
              "Could not edit reply.",
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        comment: data,
        status: data.status,
      });
    }

    // ==========================================================
    // INVALID ACTION
    // ==========================================================

    return NextResponse.json(
      {
        error:
          "Invalid action. Use approve, reject, or edit.",
      },
      {
        status: 400,
      }
    );

  } catch (error) {
    console.error(
      "Comment moderation route error:",
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


// ============================================================
// DELETE COMMENT
// ============================================================

export async function DELETE(
  request,
  { params }
) {
  try {
    // ==========================================================
    // CHECK THAT ADMIN IS LOGGED IN
    // ==========================================================

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // ==========================================================
    // GET COMMENT ID
    // ==========================================================

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Comment ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // ADMIN CLIENT
    // ==========================================================

    const supabaseAdmin =
      createAdminClient();

    // ==========================================================
    // CHECK WHETHER THIS IS AN ADMIN REPLY
    // ==========================================================

    const {
      data: existingComment,
      error: lookupError,
    } = await supabaseAdmin
      .from("comments")
      .select(
        "id, is_admin"
      )
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "Could not find comment before deletion:",
        lookupError
      );

      return NextResponse.json(
        {
          error:
            lookupError.message ||
            "Could not find comment.",
        },
        {
          status: 500,
        }
      );
    }

    if (!existingComment) {
      return NextResponse.json(
        {
          error:
            "Comment not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================================
    // DELETE COMMENT
    // ==========================================================

    const { error } =
      await supabaseAdmin
        .from("comments")
        .delete()
        .eq("id", id);

    if (error) {
      console.error(
        "Supabase comment deletion error:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message ||
            "Could not delete comment.",
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================================
    // SUCCESS
    // ==========================================================

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error(
      "Comment deletion route error:",
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