import crypto from "crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { State } from "country-state-city";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createClient } from "@/src/lib/supabase/server";
import { getUserRole } from "@/src/lib/admin/permissions";
import { recordQikinkFailure, submitQikinkOrder } from "@/src/lib/commerce/qikink";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function verifySignature(orderId, paymentId, signature, secret) {
  if (!secret || typeof signature !== "string") return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  let received;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

async function isAuthorizedPreviewAdmin() {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  return Boolean(user && getUserRole(user) === "admin");
}

export async function POST(request) {
  const supabaseAdmin = createAdminClient();
  let createdOrderId;
  let createdOrderIsPod = false;

  try {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
    } = await request.json();

    if (!razorpayOrderId || !razorpayPaymentId) {
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
    }

    const { data: checkoutSession, error: checkoutSessionError } = await supabaseAdmin
      .from("checkout_sessions")
      .select("customer_email, shipping_address, items, subtotal_amount, discount_amount, promo_code, status, is_preview")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();
    if (checkoutSessionError) throw checkoutSessionError;
    if (!checkoutSession) {
      return NextResponse.json({ error: "Checkout details could not be found for this payment." }, { status: 400 });
    }

    if (checkoutSession.is_preview) {
      if (!await isAuthorizedPreviewAdmin()) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
    }
    if (!verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, process.env.RAZORPAY_KEY_SECRET)) {
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
    }

    const { data: existingOrder, error: existingOrderError } = await supabaseAdmin
      .from("orders")
      .select("id, fulfillment_error, is_preview")
      .eq("razorpay_payment_id", razorpayPaymentId)
      .maybeSingle();
    if (existingOrderError) throw existingOrderError;
    if (existingOrder) {
      const { data: redemption, error: redemptionLookupError } = await supabaseAdmin
        .from("promo_redemptions")
        .select("id, status")
        .eq("razorpay_order_id", razorpayOrderId)
        .maybeSingle();
      if (redemptionLookupError) throw redemptionLookupError;
      if (redemption && redemption.status !== "redeemed") {
        const { error: redemptionUpdateError } = await supabaseAdmin
          .from("promo_redemptions")
          .update(existingOrder.is_preview
            ? { status: "released" }
            : { status: "redeemed", order_id: existingOrder.id })
          .eq("id", redemption.id);
        if (redemptionUpdateError) throw redemptionUpdateError;
      }
      const { error: sessionUpdateError } = await supabaseAdmin
        .from("checkout_sessions")
        .update({ status: "completed", order_id: existingOrder.id })
        .eq("razorpay_order_id", razorpayOrderId);
      if (sessionUpdateError) throw sessionUpdateError;
      return NextResponse.json({
        success: true,
        orderId: existingOrder.id,
        fulfillmentWarning: existingOrder.fulfillment_error || null,
      });
    }

    if (checkoutSession.status !== "pending") {
      return NextResponse.json({ error: "This checkout has already been completed." }, { status: 409 });
    }
    if (
      !checkoutSession.customer_email ||
      checkoutSession.shipping_address?.country !== "IN" ||
      !Array.isArray(checkoutSession.items) ||
      checkoutSession.items.length === 0
    ) {
      return NextResponse.json({ error: "The saved checkout details are incomplete." }, { status: 400 });
    }

    const orderItems = checkoutSession.items;
    if (orderItems.some((item) =>
      !item.product_id ||
      !Number.isFinite(Number(item.price)) ||
      Number(item.price) < 0 ||
      !Number.isInteger(Number(item.quantity)) ||
      Number(item.quantity) < 1
    )) {
      return NextResponse.json({ error: "The saved checkout contains invalid product details." }, { status: 400 });
    }
    const totalAmount = Number(checkoutSession.subtotal_amount);
    const discountAmount = Number(checkoutSession.discount_amount);
    const itemSubtotal = orderItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    if (
      !Number.isFinite(totalAmount) ||
      !Number.isFinite(discountAmount) ||
      discountAmount < 0 ||
      discountAmount > totalAmount ||
      Math.round(itemSubtotal * 100) !== Math.round(totalAmount * 100)
    ) {
      return NextResponse.json({ error: "The saved checkout total is invalid." }, { status: 400 });
    }
    const { data: redemption, error: redemptionError } = await supabaseAdmin
      .from("promo_redemptions")
      .select("id, code, subtotal_amount, discount_amount")
      .eq("razorpay_order_id", razorpayOrderId)
      .eq("status", "reserved")
      .maybeSingle();
    if (redemptionError) throw redemptionError;
    if (
      (checkoutSession.promo_code && (
        !redemption ||
        redemption.code !== checkoutSession.promo_code ||
        Math.round(Number(redemption.subtotal_amount) * 100) !== Math.round(totalAmount * 100) ||
        Math.round(Number(redemption.discount_amount) * 100) !== Math.round(discountAmount * 100)
      )) ||
      (!checkoutSession.promo_code && redemption)
    ) {
      return NextResponse.json({ error: "The promo reservation does not match this checkout." }, { status: 400 });
    }

    const [razorpayOrder, payment] = await Promise.all([
      razorpay.orders.fetch(razorpayOrderId),
      razorpay.payments.fetch(razorpayPaymentId),
    ]);

    if (
      payment.order_id !== razorpayOrderId ||
      payment.status !== "captured" ||
      payment.currency !== "INR" ||
      payment.amount !== razorpayOrder.amount ||
      payment.amount !== Math.round((totalAmount - discountAmount) * 100)
    ) {
      return NextResponse.json({ error: "The captured payment does not match this order total." }, { status: 400 });
    }

    const hasPodItems = orderItems.some((item) => item.order_type === "pod");
    const shippingAddress = checkoutSession.shipping_address;
    const stateCode = State.getStatesOfCountry("IN")
      .find((state) => state.name.toLowerCase() === shippingAddress.state.trim().toLowerCase())
      ?.isoCode || shippingAddress.state_code || shippingAddress.state;
    const safeShippingAddress = {
      name: String(shippingAddress.name).trim(),
      phone: String(shippingAddress.phone).trim(),
      line1: String(shippingAddress.line1).trim(),
      city: String(shippingAddress.city).trim(),
      state: String(shippingAddress.state).trim(),
      state_code: stateCode,
      country: "IN",
      zip: String(shippingAddress.zip).trim(),
    };

    const { data: order, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_email: checkoutSession.customer_email,
        user_email: checkoutSession.customer_email,
        shipping_address: safeShippingAddress,
        items: orderItems,
        total_amount: totalAmount - discountAmount,
        subtotal_amount: totalAmount,
        discount_amount: discountAmount,
        promo_code: redemption?.code || null,
        status: hasPodItems ? "POD Order Submission Pending" : "Order Placed",
        pod_provider: hasPodItems ? "qikink" : null,
        is_preview: false,
        payment_method: "razorpay",
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    createdOrderId = order.id;
    createdOrderIsPod = hasPodItems;

    if (redemption) {
      const { error: redemptionUpdateError } = await supabaseAdmin
        .from("promo_redemptions")
        .update(order.is_preview
          ? { status: "released" }
          : { status: "redeemed", order_id: order.id })
        .eq("id", redemption.id);
      if (redemptionUpdateError) throw redemptionUpdateError;
    }
    const { error: sessionUpdateError } = await supabaseAdmin
      .from("checkout_sessions")
      .update({ status: "completed", order_id: order.id })
      .eq("razorpay_order_id", razorpayOrderId);
    if (sessionUpdateError) throw sessionUpdateError;

    let fulfillmentWarning = null;
    if (hasPodItems) {
      try {
        await submitQikinkOrder(order, supabaseAdmin);
      } catch (error) {
        fulfillmentWarning = error.message;
        await recordQikinkFailure(order.id, fulfillmentWarning, supabaseAdmin);
        console.error("Qikink order submission failed:", error);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      fulfillmentWarning,
    });
  } catch (error) {
    console.error("Payment verification/order fulfillment error:", error);
    if (createdOrderId && createdOrderIsPod) {
      await recordQikinkFailure(createdOrderId, error.message, supabaseAdmin);
    }
    return NextResponse.json(
      { error: error.message || "Payment verification failed." },
      { status: 500 }
    );
  }
}
