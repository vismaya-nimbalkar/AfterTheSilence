import crypto from "crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { syncOrderRefunds } from "@/src/lib/commerce/refunds";

export async function POST(request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = request.headers.get("x-razorpay-signature");

  if (!secret || !signature) {
    return NextResponse.json({ error: "Razorpay webhook verification is not configured." }, { status: 500 });
  }

  const body = await request.text();
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  let received;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return NextResponse.json({ error: "Invalid Razorpay webhook signature." }, { status: 400 });
  }
  if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: "Invalid Razorpay webhook signature." }, { status: 400 });
  }

  const event = JSON.parse(body);
  if (event.event === "refund.processed" || event.event === "refund.failed") {
    try {
      const refund = event.payload?.refund?.entity;
      if (!refund?.id || !refund.payment_id) {
        return NextResponse.json({ error: "Refund webhook payload is incomplete." }, { status: 400 });
      }

      const supabaseAdmin = createAdminClient();
      const status = event.event === "refund.processed" ? "processed" : "failed";
      let { data: updated, error } = await supabaseAdmin
        .from("order_refunds")
        .update({
          razorpay_refund_id: refund.id,
          status,
          error: status === "failed" ? refund.error_reason || "Razorpay reported a failed refund." : null,
          updated_at: new Date().toISOString(),
        })
        .eq("razorpay_refund_id", refund.id)
        .select("id, order_id")
        .maybeSingle();
      if (error) throw error;

      if (!updated && refund.amount) {
        const { data: candidates, error: candidateError } = await supabaseAdmin
          .from("order_refunds")
          .select("id, order_id")
          .eq("razorpay_payment_id", refund.payment_id)
          .in("status", ["pending", "unknown"])
          .eq("amount", Number(refund.amount) / 100);
        if (candidateError) throw candidateError;
        if (candidates?.length === 1) {
          const { data: recovered, error: recoveredError } = await supabaseAdmin
            .from("order_refunds")
            .update({
              razorpay_refund_id: refund.id,
              status,
              error: status === "failed" ? refund.error_reason || "Razorpay reported a failed refund." : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", candidates[0].id)
            .select("id, order_id")
            .single();
          if (recoveredError) throw recoveredError;
          updated = recovered;
        }
      }
      const orderLookup = supabaseAdmin
        .from("orders")
        .select("id, total_amount, razorpay_payment_id");
      const { data: order, error: orderError } = updated
        ? await orderLookup.eq("id", updated.order_id).maybeSingle()
        : await orderLookup.eq("razorpay_payment_id", refund.payment_id).maybeSingle();
      if (orderError) throw orderError;
      if (!order) {
        return NextResponse.json({ error: "No matching order was found for this refund." }, { status: 404 });
      }

      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      await syncOrderRefunds(order, supabaseAdmin, razorpay);
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("Razorpay refund webhook processing error:", error);
      return NextResponse.json({ error: error.message || "Could not process refund webhook." }, { status: 500 });
    }
  }

  // Payment verification creates the order; this webhook must not create duplicates.
  return NextResponse.json({ received: true });
}
