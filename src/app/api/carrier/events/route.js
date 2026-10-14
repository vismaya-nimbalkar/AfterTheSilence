import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

function hasValidToken(receivedToken) {
  const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (!expectedToken || !receivedToken) return false;
  const expected = Buffer.from(expectedToken);
  const received = Buffer.from(receivedToken);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function mapShipmentStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (!status) return null;
  if (status.includes("RTO") || status.includes("RETURNED") || status.includes("UNDELIVERED") || status.includes("LOST") || status.includes("DAMAGED")) {
    return "Delivery Exception";
  }
  if (status.includes("DELIVERED")) return "Delivered";
  if (status.includes("OUT FOR DELIVERY")) return "Out for Delivery";
  if (status.includes("CANCEL")) return "Cancelled";
  if (status.includes("TRANSIT") || status.includes("PICKED UP") || status.includes("SHIPPED")) return "Shipped";
  if (status.includes("PICKUP") || status.includes("MANIFEST") || status === "NEW" || status === "ORDER PLACED") {
    return "Order Placed";
  }
  return null;
}

export async function POST(request) {
  const webhookToken = request.headers.get("x-api-key") || request.headers.get("anx-api-key");
  if (!hasValidToken(webhookToken)) {
    return NextResponse.json({ error: "Invalid tracking webhook credential." }, { status: 401 });
  }

  try {
    const event = await request.json();
    const awb = String(event.awb || "").trim();
    const currentStatus = event.current_status || event.shipment_status;
    const status = mapShipmentStatus(currentStatus);

    if (!awb || !status) {
      return NextResponse.json({ error: "Webhook must include a supported AWB and shipment status." }, { status: 400 });
    }

    const { data: orders, error } = await createAdminClient()
      .from("orders")
      .update({ status })
      .eq("tracking_provider", "shiprocket")
      .eq("tracking_number", awb)
      .select("id");

    if (error) throw error;
    if (!orders?.length) {
      return NextResponse.json({ error: "No Shiprocket order matches this AWB." }, { status: 404 });
    }

    return NextResponse.json({ received: true, updatedOrders: orders.length });
  } catch (error) {
    console.error("Carrier tracking webhook error:", error);
    return NextResponse.json({ error: error.message || "Could not apply tracking update." }, { status: 500 });
  }
}
