import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { calculatePromoDiscount, findAvailablePromo } from "@/src/lib/commerce/promotions";

export async function POST(request) {
  try {
    const { code, subtotal } = await request.json();
    const amount = Number(subtotal);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Enter a valid order subtotal." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { promo, error } = await findAvailablePromo(supabaseAdmin, code, amount);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const discountAmount = calculatePromoDiscount(promo, amount);
    return NextResponse.json({
      success: true,
      code: promo.code,
      discountAmount,
      totalAmount: Math.max(0, amount - discountAmount),
    });
  } catch (error) {
    console.error("Promo validation error:", error);
    return NextResponse.json({ error: error.message || "Could not validate promo code." }, { status: 500 });
  }
}
