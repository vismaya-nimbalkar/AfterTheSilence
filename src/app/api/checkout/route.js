import Razorpay from "razorpay";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";
import { getUserRole } from "@/src/lib/admin/permissions";
import { getShopEnabled } from "@/src/lib/siteSettings";
import { calculatePromoDiscount, findAvailablePromo } from "@/src/lib/commerce/promotions";
import { isQikinkReadyForCheckout } from "@/src/lib/commerce/qikink";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export async function POST(req) {
  try {
    const { items, customerEmail, shippingAddress, promoCode, preview = false } = await req.json();

    if (preview) {
      const sessionClient = await createClient();
      const { data: { user } } = await sessionClient.auth.getUser();
      if (!user || getUserRole(user) !== "admin") {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    if (shippingAddress?.country !== "IN") {
      return NextResponse.json({ error: "We currently ship to India only." }, { status: 400 });
    }
    if (!customerEmail || !shippingAddress?.name || !shippingAddress?.phone || !shippingAddress?.line1 || !shippingAddress?.city || !shippingAddress?.state || !shippingAddress?.zip) {
      return NextResponse.json({ error: "Complete your contact and shipping details before checkout." }, { status: 400 });
    }

    const quantities = new Map();
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.product_id || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return NextResponse.json({ error: "The cart contains an invalid product or quantity." }, { status: 400 });
      }
      quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + quantity);
    }

    const supabaseAdmin = createAdminClient();
    if (!(await getShopEnabled(supabaseAdmin)) && !preview) {
      return NextResponse.json({ error: "The shop is currently unavailable." }, { status: 404 });
    }

    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, title, price, images, is_published, is_in_stock, is_pod, qikink_sku")
      .in("id", [...quantities.keys()]);
    if (productsError) throw productsError;

    if (products.length !== quantities.size || products.some((product) => !product.is_published || product.is_in_stock === false)) {
      return NextResponse.json({ error: "A product in your cart is unavailable. Refresh your cart and try again." }, { status: 400 });
    }
    if (products.some((product) => product.is_pod !== false && !product.qikink_sku)) {
      return NextResponse.json({ error: "A print-on-demand product is not connected to Qikink yet. Please contact the shop owner." }, { status: 409 });
    }
    if (products.some((product) => product.is_pod !== false) && !isQikinkReadyForCheckout()) {
      return NextResponse.json({ error: "Print-on-demand checkout is temporarily unavailable while Qikink is being configured." }, { status: 503 });
    }

    const totalAmount = products.reduce(
      (acc, product) => acc + Number(product.price) * quantities.get(product.id),
      0
    );
    const orderItems = products.map((product) => ({
      product_id: product.id,
      title: product.title,
      price: Number(product.price),
      quantity: quantities.get(product.id),
      order_type: product.is_pod === false ? "normal" : "pod",
      ...(product.is_pod !== false ? { qikink_sku: product.qikink_sku } : {}),
      image_url: product.images?.[0] || "",
    }));

    let discountAmount = 0;
    let normalizedPromoCode = null;
    let checkoutSessionId = null;
    if (String(promoCode || "").trim()) {
      const { promo, error: promoError } = await findAvailablePromo(supabaseAdmin, promoCode, totalAmount);
      if (promoError) return NextResponse.json({ error: promoError }, { status: 400 });

      checkoutSessionId = crypto.randomUUID();
      const { data: reservation, error: reservationError } = await supabaseAdmin.rpc("reserve_promo_redemption", {
        p_code: String(promoCode).trim().toUpperCase(),
        p_checkout_session_id: checkoutSessionId,
        p_subtotal_amount: totalAmount,
      });
      if (reservationError) {
        return NextResponse.json({ error: reservationError.message || "Could not reserve this promo code." }, { status: 400 });
      }

      const reserved = Array.isArray(reservation) ? reservation[0] : reservation;
      if (!reserved) {
        return NextResponse.json({ error: "Could not reserve this promo code." }, { status: 409 });
      }
      normalizedPromoCode = reserved.normalized_code;
      discountAmount = Number(reserved.discount_amount);
      if (Math.abs(discountAmount - calculatePromoDiscount(promo, totalAmount)) >= 0.01) {
        await supabaseAdmin.from("promo_redemptions")
          .update({ status: "released" })
          .eq("checkout_session_id", checkoutSessionId);
        throw new Error("Promo discount changed while checking out. Please try again.");
      }
    }

    const payableAmount = Math.max(0, totalAmount - discountAmount);
    const amountInPaise = Math.round(payableAmount * 100);

    if (amountInPaise < 100) {
      if (checkoutSessionId) {
        await supabaseAdmin.from("promo_redemptions")
          .update({ status: "released" })
          .eq("checkout_session_id", checkoutSessionId);
      }
      return NextResponse.json(
        { error: "Minimum order amount is ₹1 (100 paise)" },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    if (!keyId) {
      if (checkoutSessionId) {
        const { error: releaseError } = await supabaseAdmin.from("promo_redemptions")
          .update({ status: "released" })
          .eq("checkout_session_id", checkoutSessionId);
        if (releaseError) console.error("Could not release promo reservation:", releaseError);
      }
      return NextResponse.json(
        { error: "Razorpay Key ID is not configured on server." },
        { status: 500 }
      );
    }

    // Call Razorpay API to create an order
    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
      });
    } catch (error) {
      if (checkoutSessionId) {
        const { error: releaseError } = await supabaseAdmin.from("promo_redemptions")
          .update({ status: "released" })
          .eq("checkout_session_id", checkoutSessionId);
        if (releaseError) console.error("Could not release promo reservation:", releaseError);
      }
      throw error;
    }

    if (checkoutSessionId) {
      const { error: reservationUpdateError } = await supabaseAdmin
        .from("promo_redemptions")
        .update({ razorpay_order_id: rzpOrder.id })
        .eq("checkout_session_id", checkoutSessionId);
      if (reservationUpdateError) {
        await supabaseAdmin.from("promo_redemptions")
          .update({ status: "released" })
          .eq("checkout_session_id", checkoutSessionId);
        throw reservationUpdateError;
      }
    }

    const safeShippingAddress = {
      name: String(shippingAddress.name).trim(),
      phone: String(shippingAddress.phone).trim(),
      line1: String(shippingAddress.line1).trim(),
      city: String(shippingAddress.city).trim(),
      state: String(shippingAddress.state).trim(),
      state_code: String(shippingAddress.state_code || shippingAddress.state).trim(),
      country: "IN",
      zip: String(shippingAddress.zip).trim(),
    };
    const { error: checkoutSessionError } = await supabaseAdmin
      .from("checkout_sessions")
      .insert({
        razorpay_order_id: rzpOrder.id,
        customer_email: String(customerEmail).trim(),
        shipping_address: safeShippingAddress,
        items: orderItems,
        subtotal_amount: totalAmount,
        discount_amount: discountAmount,
        promo_code: normalizedPromoCode,
        is_preview: Boolean(preview),
      });
    if (checkoutSessionError) {
      if (checkoutSessionId) {
        const { error: releaseError } = await supabaseAdmin.from("promo_redemptions")
          .update({ status: "released" })
          .eq("checkout_session_id", checkoutSessionId);
        if (releaseError) console.error("Could not release promo reservation:", releaseError);
      }
      throw checkoutSessionError;
    }

    return NextResponse.json({
      success: true,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: keyId,
      subtotalAmount: totalAmount,
      discountAmount,
      totalAmount: payableAmount,
      promoCode: normalizedPromoCode,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}