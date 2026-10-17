import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { hasEditorPermission } from "@/src/lib/admin/permissions";
import { syncOrderRefunds } from "@/src/lib/commerce/refunds";

async function getAuthorizedAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  if (!hasEditorPermission(user, "shop")) {
    return { response: NextResponse.json({ error: "You do not have permission to manage shop orders." }, { status: 403 }) };
  }
  return { supabaseAdmin: createAdminClient() };
}

// GET: Fetch all orders for Admin
export async function GET() {
  try {
    const { response, supabaseAdmin } = await getAuthorizedAdmin();
    if (response) return response;
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const orderIds = (orders || []).map((order) => order.id);
    let refundsByOrder = new Map();
    let shipmentsByOrder = new Map(orderIds.map((id) => [id, []]));
    if (orderIds.length) {
      const { data: shipments, error: shipmentsError } = await supabaseAdmin
        .from("order_shipments")
        .select("id, order_id, kind, shiprocket_order_id, shipment_id, awb_code, courier_name, tracking_url, status, items, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });
      if (shipmentsError) throw shipmentsError;
      for (const shipment of shipments || []) shipmentsByOrder.get(shipment.order_id)?.push(shipment);
    }
    if (orderIds.length) {
      const { data: refunds, error: refundsError } = await supabaseAdmin
        .from("order_refunds")
        .select("id, order_id, amount, status, razorpay_refund_id, error, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });
      if (refundsError) throw refundsError;
      refundsByOrder = new Map(orderIds.map((id) => [id, []]));
      for (const refund of refunds || []) refundsByOrder.get(refund.order_id)?.push(refund);
    }

    const ordersWithPendingRefunds = (orders || []).filter((order) =>
      order.razorpay_payment_id
      && (
        order.refund_status === "pending"
        || (refundsByOrder.get(order.id) || []).some((refund) => ["pending", "unknown"].includes(refund.status))
      )
    );
    if (ordersWithPendingRefunds.length) {
      await Promise.all(ordersWithPendingRefunds.map(async (order) => {
        try {
          const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
          });
          const synced = await syncOrderRefunds(order, supabaseAdmin, razorpay);
          Object.assign(order, synced);
        } catch (error) {
          console.error(`Could not sync Razorpay refunds for order ${order.id}:`, error);
          order.refund_sync_error = "Could not refresh refund status from Razorpay. Try again shortly.";
        }
      }));

      const { data: latestRefunds, error: latestRefundsError } = await supabaseAdmin
        .from("order_refunds")
        .select("id, order_id, amount, status, razorpay_refund_id, error, created_at")
        .in("order_id", ordersWithPendingRefunds.map((order) => order.id))
        .order("created_at", { ascending: false });
      if (latestRefundsError) throw latestRefundsError;
      for (const order of ordersWithPendingRefunds) refundsByOrder.set(order.id, []);
      for (const refund of latestRefunds || []) refundsByOrder.get(refund.order_id)?.push(refund);
    }

    return NextResponse.json({
      success: true,
      orders: (orders || []).map((order) => ({
        ...order,
        refunds: refundsByOrder.get(order.id) || [],
        shipments: shipmentsByOrder.get(order.id) || [],
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH() {
  return NextResponse.json({
    error: "Shipping status and tracking are synchronized from Shiprocket and cannot be edited manually.",
  }, { status: 409 });
}

// DELETE: Permanently delete an order from Supabase
export async function DELETE(req) {
  try {
    const { response, supabaseAdmin } = await getAuthorizedAdmin();
    if (response) return response;
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "Missing Order ID" }, { status: 400 });
    }

    const { error: refundsError } = await supabaseAdmin
      .from("order_refunds")
      .delete()
      .eq("order_id", orderId);
    if (refundsError) throw refundsError;

    const { error } = await supabaseAdmin
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (error) throw error;

    return NextResponse.json({ success: true, deletedId: orderId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}