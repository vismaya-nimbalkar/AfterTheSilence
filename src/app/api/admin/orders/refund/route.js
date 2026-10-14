import { randomUUID } from "crypto";
import Razorpay from "razorpay";
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
  return { user, supabaseAdmin: createAdminClient() };
}

export async function POST(request) {
  const { response, user, supabaseAdmin } = await getAuthorizedAdmin();
  if (response) return response;

  let refundRecordId;
  try {
    const { orderId, amount } = await request.json();
    const refundAmount = Number(amount);
    if (!orderId || !Number.isFinite(refundAmount) || refundAmount <= 0 || Math.round(refundAmount * 100) !== refundAmount * 100) {
      return NextResponse.json({ error: "Enter a valid refund amount with no more than two decimal places." }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount, payment_method, razorpay_payment_id, is_preview")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.is_preview) {
      return NextResponse.json({ error: "Preview test orders cannot be refunded." }, { status: 409 });
    }
    if (!order.razorpay_payment_id) {
      return NextResponse.json({ error: "Only captured Razorpay payments can be refunded automatically. Offline payments must be refunded outside the site." }, { status: 409 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const payment = await razorpay.payments.fetch(order.razorpay_payment_id);
    const expectedAmountPaise = Math.round(Number(order.total_amount) * 100);
    if (payment.status !== "captured" || payment.amount !== expectedAmountPaise) {
      return NextResponse.json({ error: "The Razorpay payment is not captured or does not match this order total." }, { status: 409 });
    }
    if (Number(payment.amount_refunded || 0) + Math.round(refundAmount * 100) > payment.amount) {
      return NextResponse.json({ error: "Refund amount exceeds the remaining captured payment." }, { status: 400 });
    }

    const requestKey = randomUUID();
    const { data: refundId, error: reservationError } = await supabaseAdmin.rpc("reserve_order_refund", {
      p_order_id: order.id,
      p_amount: refundAmount,
      p_request_key: requestKey,
      p_admin_user_id: user.id,
    });
    if (reservationError) {
      return NextResponse.json({ error: reservationError.message || "Could not reserve this refund." }, { status: 400 });
    }
    refundRecordId = refundId;

    try {
      const gatewayRefund = await razorpay.payments.refund(order.razorpay_payment_id, {
        amount: Math.round(refundAmount * 100),
        notes: { store_order_id: order.id, admin_user_id: user.id },
        receipt: `refund_${String(refundId).replaceAll("-", "").slice(0, 20)}`,
      });
      const status = gatewayRefund.status === "processed" ? "processed" : "pending";
      const { data: savedRefund, error: updateError } = await supabaseAdmin
        .from("order_refunds")
        .update({
          razorpay_refund_id: gatewayRefund.id,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", refundId)
        .select()
        .single();
      if (updateError) throw updateError;

      const { data: refunds, error: refundsError } = await supabaseAdmin
        .from("order_refunds")
        .select("amount, status")
        .eq("order_id", order.id);
      if (refundsError) throw refundsError;
      const processedAmount = (refunds || [])
        .filter((refund) => refund.status === "processed")
        .reduce((total, refund) => total + Number(refund.amount), 0);
      const refundStatus = (refunds || []).some((refund) => ["pending", "unknown"].includes(refund.status))
        ? "pending"
        : processedAmount >= Number(order.total_amount) ? "full" : processedAmount > 0 ? "partial" : null;
      const { error: orderUpdateError } = await supabaseAdmin
        .from("orders")
        .update({ refunded_amount: processedAmount, refund_status: refundStatus })
        .eq("id", order.id);
      if (orderUpdateError) throw orderUpdateError;

      return NextResponse.json({ success: true, refund: savedRefund, refundedAmount: processedAmount });
    } catch (gatewayError) {
      const uncertain = !gatewayError.statusCode && !gatewayError.status;
      const { error: recordError } = await supabaseAdmin
        .from("order_refunds")
        .update({
          status: uncertain ? "unknown" : "failed",
          error: gatewayError.message || "Razorpay did not confirm the refund.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", refundId);
      if (recordError) console.error("Could not record refund request failure:", recordError);

      if (uncertain) {
        return NextResponse.json({
          error: "Razorpay did not confirm whether it accepted the refund. The amount is reserved to prevent duplicate refunds; check Razorpay before retrying.",
        }, { status: 502 });
      }
      throw gatewayError;
    }
  } catch (error) {
    console.error("Admin refund processing error:", error);
    if (refundRecordId && !error.statusCode && !error.status) {
      const { error: recordError } = await supabaseAdmin
        .from("order_refunds")
        .update({
          status: "unknown",
          error: error.message || "Refund processing outcome needs reconciliation.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", refundRecordId)
        .eq("status", "pending");
      if (recordError) console.error("Could not mark refund as requiring reconciliation:", recordError);
      return NextResponse.json({
        error: "Refund processing outcome needs reconciliation. Check Razorpay before retrying to avoid a duplicate refund.",
      }, { status: 502 });
    }
    return NextResponse.json({ error: error.message || "Could not process refund." }, { status: 502 });
  }
}
