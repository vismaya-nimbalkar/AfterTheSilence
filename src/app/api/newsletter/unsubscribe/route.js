import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

function createToken(email) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(email)
    .digest("hex");
}

function isValidToken(email, token) {
  if (!email || !token) return false;

  const expected = createToken(email);
  const received = Buffer.from(String(token));
  const expectedBuffer = Buffer.from(expected);

  return (
    received.length === expectedBuffer.length &&
    timingSafeEqual(received, expectedBuffer)
  );
}

// Handle GET request (When user clicks link in email)
export async function GET(request) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const token = request.nextUrl.searchParams.get("token");

  if (!isValidToken(email, token)) {
    return new NextResponse("This unsubscribe link is invalid or expired.", { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("newsletter_subscribers")
    .delete()
    .eq("email", email);

  if (error) {
    console.error("Newsletter unsubscribe error:", error);
    return new NextResponse("We could not process your unsubscribe request.", { status: 500 });
  }

  return new NextResponse(
    "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Unsubscribed</title></head><body style=\"margin:0;background:#fff;color:#3c3b3d;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px\"><main style=\"max-width:520px;text-align:center\"><h1>You have been unsubscribed</h1><p>You will no longer receive the After The Silence newsletter at this address.</p></main></body></html>",
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// Handle POST request (For Gmail/Apple Mail native One-Click unsubscribe)
export async function POST(request) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const token = request.nextUrl.searchParams.get("token");

  if (!isValidToken(email, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("newsletter_subscribers")
    .delete()
    .eq("email", email);

  if (error) {
    console.error("Newsletter unsubscribe error:", error);
    return NextResponse.json({ error: "Could not unsubscribe" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}