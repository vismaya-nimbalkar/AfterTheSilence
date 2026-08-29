import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

// ============================================================
// GET — LIST BANNED COMMENTERS
// ============================================================

export async function GET() {
  try {
    const supabase = await createClient();

    // ----------------------------------------------------------
    // Check admin login
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // Get bans
    // ----------------------------------------------------------

    const {
      data: bannedUsers,
      error,
    } = await supabase
      .from("comment_bans")
      .select(
        "id, ip_hash, email, reason, created_at"
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Could not load comment bans:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message ||
            "Could not load banned commenters.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      bannedUsers: bannedUsers || [],
    });

  } catch (error) {
    console.error(
      "Banned users GET error:",
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
// DELETE — UNBAN
// ============================================================

export async function DELETE(request) {
  try {
    const supabase = await createClient();

    // ----------------------------------------------------------
    // Check admin login
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // Get ban ID
    // ----------------------------------------------------------

    const body = await request.json();

    const id = body?.id;

    if (!id) {
      return NextResponse.json(
        {
          error: "Ban ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------------------------
    // Delete ban
    // ----------------------------------------------------------

    const { error } = await supabase
      .from("comment_bans")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(
        "Could not unban commenter:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message ||
            "Could not unban commenter.",
        },
        {
          status: 500,
        }
      );
    }

    // ----------------------------------------------------------
    // Success
    // ----------------------------------------------------------

    return NextResponse.json({
      success: true,
      message: "Commenter has been unbanned.",
    });

  } catch (error) {
    console.error(
      "Unban route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while unbanning.",
      },
      {
        status: 500,
      }
    );
  }
}