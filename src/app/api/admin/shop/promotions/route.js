import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";

async function getAuthorizedAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || getUserRole(user) !== "admin") {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  return { supabaseAdmin: createAdminClient() };
}

export async function GET() {
  try {
    const { response, supabaseAdmin } = await getAuthorizedAdmin();
    if (response) return response;
    const { data, error } = await supabaseAdmin
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ promotions: data || [] });
  } catch (error) {
    console.error("Admin promotions GET error:", error);
    return NextResponse.json({ error: error.message || "Could not load promo codes." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { response, supabaseAdmin } = await getAuthorizedAdmin();
    if (response) return response;
    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();
    const discountType = body.discount_type;
    const discountValue = Number(body.discount_value);
    const minimumOrderAmount = Number(body.minimum_order_amount || 0);
    const maxUses = body.max_uses === "" || body.max_uses == null ? null : Number(body.max_uses);
    const maxDiscountAmount = body.max_discount_amount === "" || body.max_discount_amount == null
      ? null
      : Number(body.max_discount_amount);
    const startsDate = body.starts_at ? new Date(body.starts_at) : null;
    const expiresDate = body.expires_at ? new Date(body.expires_at) : null;

    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return NextResponse.json({ error: "Promo code must be 3–32 letters, numbers, hyphens, or underscores." }, { status: 400 });
    }
    if (!["percent", "fixed"].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0) {
      return NextResponse.json({ error: "Enter a valid discount type and amount." }, { status: 400 });
    }
    if (discountType === "percent" && discountValue > 100) {
      return NextResponse.json({ error: "Percentage discount cannot exceed 100%." }, { status: 400 });
    }
    if (!Number.isFinite(minimumOrderAmount) || minimumOrderAmount < 0 ||
        (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) ||
        (maxDiscountAmount !== null && (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount <= 0))) {
      return NextResponse.json({ error: "Check the minimum order, usage limit, and maximum discount." }, { status: 400 });
    }
    if ((startsDate && Number.isNaN(startsDate.getTime())) || (expiresDate && Number.isNaN(expiresDate.getTime()))) {
      return NextResponse.json({ error: "Enter valid promotion start and expiry dates." }, { status: 400 });
    }
    const startsAt = startsDate?.toISOString() || null;
    const expiresAt = expiresDate?.toISOString() || null;
    if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
      return NextResponse.json({ error: "The expiry date must be after the start date." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("promo_codes")
      .insert({
        code,
        discount_type: discountType,
        discount_value: discountValue,
        max_discount_amount: maxDiscountAmount,
        minimum_order_amount: minimumOrderAmount,
        max_uses: maxUses,
        starts_at: startsAt,
        expires_at: expiresAt,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, promotion: data }, { status: 201 });
  } catch (error) {
    console.error("Admin promo create error:", error);
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? "That promo code already exists." : error.message || "Could not create promo code." }, { status });
  }
}

export async function PATCH(request) {
  try {
    const { response, supabaseAdmin } = await getAuthorizedAdmin();
    if (response) return response;
    const { id, is_active: isActive } = await request.json();
    if (!id || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Promo code ID and active status are required." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("promo_codes")
      .update({ is_active: isActive })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Promo code not found." }, { status: 404 });
    return NextResponse.json({ success: true, promotion: data });
  } catch (error) {
    console.error("Admin promo update error:", error);
    return NextResponse.json({ error: error.message || "Could not update promo code." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { response, supabaseAdmin } = await getAuthorizedAdmin();
    if (response) return response;
    const { id } = await request.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Promo code ID is required." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("promo_codes")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Promo code not found." }, { status: 404 });
    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Admin promo delete error:", error);
    return NextResponse.json({ error: error.message || "Could not delete promo code." }, { status: 500 });
  }
}
