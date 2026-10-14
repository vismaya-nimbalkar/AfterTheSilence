import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";
import { recordQikinkFailure, submitQikinkOrder, syncQikinkOrder } from "@/src/lib/commerce/qikink";

export async function POST(request) {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user || getUserRole(user) !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  let orderId;
  let action;
  try {
    ({ orderId, action = "submit" } = await request.json());
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const hasPodItems = Array.isArray(order.items) && order.items.some((item) => item.order_type === "pod");
    if (!hasPodItems) {
      return NextResponse.json({ error: "This order has no POD items." }, { status: 400 });
    }
    if (order.pod_provider !== "qikink") {
      return NextResponse.json({ error: "This is a legacy Printful order and cannot be submitted to Qikink." }, { status: 409 });
    }

    if (action === "sync") {
      if (order.pod_provider !== "qikink" || !order.qikink_order_number) {
        return NextResponse.json({ error: "This order has no Qikink reference to refresh." }, { status: 409 });
      }
      const updatedOrder = await syncQikinkOrder(order, supabaseAdmin);
      return NextResponse.json({ success: true, order: updatedOrder });
    }
    if (action !== "submit") {
      return NextResponse.json({ error: "Unsupported fulfillment action." }, { status: 400 });
    }

    const updatedOrder = await submitQikinkOrder(order, supabaseAdmin);
    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Admin Qikink fulfillment action error:", error);
    if (orderId && action === "submit") await recordQikinkFailure(orderId, error.message, supabaseAdmin);
    return NextResponse.json({ error: error.message || "Could not process Qikink order." }, { status: 502 });
  }
}
