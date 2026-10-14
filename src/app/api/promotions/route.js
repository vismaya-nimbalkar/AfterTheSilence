import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

export async function GET() {
  try {
    const { data, error } = await createAdminClient()
      .from("promo_codes")
      .select("code, discount_type, discount_value, max_discount_amount, minimum_order_amount, starts_at, expires_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const now = Date.now();
    const promotions = (data || []).filter((promo) =>
      (!promo.starts_at || new Date(promo.starts_at).getTime() <= now)
      && (!promo.expires_at || new Date(promo.expires_at).getTime() > now)
    );

    return NextResponse.json({ promotions });
  } catch (error) {
    console.error("Public promotions GET error:", error);
    return NextResponse.json({ error: error?.message || "Could not load available coupons." }, { status: 500 });
  }
}
