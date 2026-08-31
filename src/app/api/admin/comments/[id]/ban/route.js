import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { getUserRole } from "@/src/lib/admin/permissions";

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();

    // ==========================================================
    // CHECK ADMIN LOGIN
    // ==========================================================

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || getUserRole(user) !== "admin") {
      return NextResponse.json(
        {
          error: "Unauthorized.",
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
    // GET COMMENT
    // ==========================================================

    const {
      data: comment,
      error: commentError,
    } = await supabase
      .from("comments")
      .select("*")
      .eq("id", id)
      .single();

    if (commentError) {
      console.error(
        "Could not find comment:",
        commentError
      );

      return NextResponse.json(
        {
          error:
            commentError.message ||
            "Could not find comment.",
        },
        {
          status: 404,
        }
      );
    }

    if (!comment) {
      return NextResponse.json(
        {
          error: "Comment not found.",
        },
        {
          status: 404,
        }
      );
    }

    // ==========================================================
    // MAKE SURE WE HAVE SOMETHING TO BAN
    // ==========================================================

    if (!comment.ip_hash && !comment.email) {
      return NextResponse.json(
        {
          error:
            "This commenter has no IP hash or email available to ban.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // CREATE BAN
    // ==========================================================

    const {
      data: existingBan,
      error: existingBanError,
    } = await supabase
      .from("comment_bans")
      .select("id")
      .eq(
        "ip_hash",
        comment.ip_hash
      )
      .maybeSingle();

    if (
      existingBanError &&
      existingBanError.code !== "PGRST116"
    ) {
      console.error(
        "Could not check existing ban:",
        existingBanError
      );

      return NextResponse.json(
        {
          error:
            existingBanError.message ||
            "Could not check existing ban.",
        },
        {
          status: 500,
        }
      );
    }

    // ----------------------------------------------------------
    // Only create the ban if one doesn't already exist
    // ----------------------------------------------------------

    if (!existingBan) {
      const { error: banError } =
        await supabase
          .from("comment_bans")
          .insert({
            ip_hash:
              comment.ip_hash || null,

            email:
              comment.email || null,

            reason:
              "Banned by administrator",

            created_by: user.id,
          });

      if (banError) {
        console.error(
          "Could not create ban:",
          banError
        );

        return NextResponse.json(
          {
            error:
              banError.message ||
              "Could not create ban.",
          },
          {
            status: 500,
          }
        );
      }
    }

    // ==========================================================
    // REJECT THE COMMENT
    // ==========================================================

    const {
      error: rejectError,
    } = await supabase
      .from("comments")
      .update({
        status: "rejected",
      })
      .eq("id", id);

    if (rejectError) {
      console.error(
        "Could not reject comment:",
        rejectError
      );

      return NextResponse.json(
        {
          error:
            rejectError.message ||
            "The commenter was banned, but the comment could not be rejected.",
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
      message: "Commenter has been banned.",
    });

  } catch (error) {
    console.error(
      "BAN ROUTE CRASH:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while banning the commenter.",
      },
      {
        status: 500,
      }
    );
  }
}