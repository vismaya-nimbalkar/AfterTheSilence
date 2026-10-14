export async function findAvailablePromo(supabaseAdmin, rawCode, subtotal) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return { error: "Enter a valid promo code." };
  }

  const { data: promo, error: queryError } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (queryError) throw queryError;
  if (!promo || !promo.is_active) return { error: "This promo code is not available." };

  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
    return { error: "This promo code is not active yet." };
  }
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= now) {
    return { error: "This promo code has expired." };
  }
  if (subtotal < Number(promo.minimum_order_amount || 0)) {
    return { error: `This promo requires a minimum order of ₹${promo.minimum_order_amount}.` };
  }

  return { promo };
}

export function calculatePromoDiscount(promo, subtotal) {
  const rawDiscount = promo.discount_type === "percent"
    ? subtotal * Number(promo.discount_value) / 100
    : Number(promo.discount_value);
  const cappedDiscount = promo.discount_type === "percent" && promo.max_discount_amount
    ? Math.min(rawDiscount, Number(promo.max_discount_amount))
    : rawDiscount;
  return Math.min(subtotal, Math.round(cappedDiscount * 100) / 100);
}
