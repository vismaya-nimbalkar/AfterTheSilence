import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getShopEnabled } from "@/src/lib/siteSettings";

export async function GET() {
  try {
    const shopEnabled = await getShopEnabled(createAdminClient());
    return NextResponse.json({ shop_enabled: shopEnabled }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Public site status error:", error);
    return NextResponse.json({ error: "Could not load site status." }, { status: 500 });
  }
}
