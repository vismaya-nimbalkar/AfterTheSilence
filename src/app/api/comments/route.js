import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function getClientIp(request) {
  const forwardedFor =
    request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return (
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function hashIp(ip) {
  return crypto
    .createHash("sha256")
    .update(
      `${ip}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    )
    .digest("hex");
}

export async function POST(request) {
  try {
    const body = await request.json();

    const slug =
      typeof body.slug === "string"
        ? body.slug.trim()
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const comment =
      typeof body.comment === "string"
        ? body.comment.trim()
        : "";

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!slug) {
      return NextResponse.json(
        {
          error: "Post slug is required.",
        },
        { status: 400 }
      );
    }

    if (!comment) {
      return NextResponse.json(
        {
          error: "Please write a comment.",
        },
        { status: 400 }
      );
    }

    if (comment.length < 2) {
      return NextResponse.json(
        {
          error: "Your comment is too short.",
        },
        { status: 400 }
      );
    }

    if (comment.length > 5000) {
      return NextResponse.json(
        {
          error:
            "Your comment is too long. Please keep it under 5000 characters.",
        },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        {
          error: "Your name is too long.",
        },
        { status: 400 }
      );
    }

    if (email.length > 320) {
      return NextResponse.json(
        {
          error: "Your email address is too long.",
        },
        { status: 400 }
      );
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    // ==========================================================
    // IP
    // ==========================================================

    const ip = getClientIp(request);
    const ipHash = hashIp(ip);

    // ==========================================================
    // CHECK BANS
    // ==========================================================

    let banQuery = supabaseAdmin
      .from("comment_bans")
      .select("id")
      .limit(1);

    if (email) {
      banQuery = banQuery.or(
        `ip_hash.eq.${ipHash},email.eq.${email}`
      );
    } else {
      banQuery = banQuery.eq(
        "ip_hash",
        ipHash
      );
    }

    const {
      data: bans,
      error: banError,
    } = await banQuery;

    if (banError) {
      console.error(
        "Ban check failed:",
        banError
      );

      return NextResponse.json(
        {
          error:
            "Could not submit your comment right now.",
        },
        { status: 500 }
      );
    }

    if (bans && bans.length > 0) {
      return NextResponse.json(
        {
          error:
            "You are not permitted to submit comments.",
        },
        { status: 403 }
      );
    }

    // ==========================================================
    // DUPLICATE COMMENT CHECK
    // ==========================================================

    const {
      data: duplicates,
    } = await supabaseAdmin
      .from("comments")
      .select("id")
      .eq("post_slug", slug)
      .eq("ip_hash", ipHash)
      .eq("comment", comment)
      .gte(
        "created_at",
        new Date(
          Date.now() - 10 * 60 * 1000
        ).toISOString()
      )
      .limit(1);

    if (duplicates && duplicates.length > 0) {
      return NextResponse.json(
        {
          error:
            "This comment has already been submitted.",
        },
        { status: 409 }
      );
    }

    // ==========================================================
    // INSERT AS PENDING
    // ==========================================================

    const { error: insertError } =
      await supabaseAdmin
        .from("comments")
        .insert({
          post_slug: slug,
          name: name || null,
          email: email || null,
          comment,
          status: "pending",
          ip_hash: ipHash,
        });

    if (insertError) {
      console.error(
        "Comment insert failed:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            "Could not submit your comment. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Your comment has been submitted and is awaiting moderation.",
      },
      { status: 201 }
    );

  } catch (error) {
    console.error(
      "Comment API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}