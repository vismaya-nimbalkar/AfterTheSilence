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

    return NextResponse.json({
      success: true,
      orders: (orders || []).map((order) => ({ ...order, refunds: refundsByOrder.get(order.id) || [] })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Update order status or tracking number
export async function PATCH(req) {
  try {
    const { response, supabaseAdmin } = await getAuthorizedAdmin();
    if (response) return response;
    const { orderId, status, trackingNumber, trackingProvider } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing Order ID" }, { status: 400 });
    }

    const { data: existingOrder, error: lookupError } = await supabaseAdmin
      .from("orders")
      .select("id, items, pod_order_id, pod_provider, tracking_provider")
      .eq("id", orderId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const hasPodItems = Boolean(existingOrder.pod_order_id) || (Array.isArray(existingOrder.items) &&
      existingOrder.items.some((item) => item.order_type === "pod" || (!item.order_type && item.pod_variant_id)));
    if (hasPodItems) {
      return NextResponse.json({ error: "POD order status and tracking are synchronized from the fulfillment provider and cannot be edited here." }, { status: 409 });
    }
    if (trackingProvider && !["manual", "shiprocket"].includes(trackingProvider)) {
      return NextResponse.json({ error: "Select a supported tracking provider." }, { status: 400 });
    }

    const selectedTrackingProvider = trackingProvider ||
      (existingOrder.tracking_provider === "shiprocket" ? "shiprocket" : "manual");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update({
        ...(status ? { status } : {}),
        tracking_number: trackingNumber?.trim() || null,
        tracking_provider: selectedTrackingProvider,
      })
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, order });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
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