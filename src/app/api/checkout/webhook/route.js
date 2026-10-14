import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

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
      if (!updated) {
        return NextResponse.json({ error: "No matching refund record was found." }, { status: 404 });
      }

      const { data: refunds, error: refundsError } = await supabaseAdmin
        .from("order_refunds")
        .select("amount, status")
        .eq("order_id", updated.order_id);
      if (refundsError) throw refundsError;
      const processedAmount = (refunds || [])
        .filter((row) => row.status === "processed")
        .reduce((total, row) => total + Number(row.amount), 0);
      const hasPending = (refunds || []).some((row) => ["pending", "unknown"].includes(row.status));
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("total_amount")
        .eq("id", updated.order_id)
        .single();
      if (orderError) throw orderError;
      const refundStatus = hasPending
        ? "pending"
        : processedAmount >= Number(order.total_amount) ? "full" : processedAmount > 0 ? "partial" : null;
      const { error: updateOrderError } = await supabaseAdmin
        .from("orders")
        .update({ refunded_amount: processedAmount, refund_status: refundStatus })
        .eq("id", updated.order_id);
      if (updateOrderError) throw updateOrderError;
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error("Razorpay refund webhook processing error:", error);
      return NextResponse.json({ error: error.message || "Could not process refund webhook." }, { status: 500 });
    }
  }

  // Payment verification creates the order; this webhook must not create duplicates.
  return NextResponse.json({ received: true });
}
