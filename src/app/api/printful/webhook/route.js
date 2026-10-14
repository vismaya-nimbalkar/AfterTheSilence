import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

function isValidWebhookSecret(receivedSecret) {
  const expectedSecret = process.env.PRINTFUL_WEBHOOK_SECRET;
  if (!expectedSecret || !receivedSecret) return false;

  const expected = Buffer.from(expectedSecret);
  const received = Buffer.from(receivedSecret);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function mapPrintfulStatus(type, status) {
  if (type === "package_shipped") return "Shipped";
  if (type === "package_returned") return "Returned";
  if (type === "order_failed") return "POD Submission Failed";
  if (type === "order_canceled") return "Cancelled";
  if (status === "inprocess") return "In Production";
  if (status === "fulfilled") return "Shipped";
  if (status === "failed") return "POD Submission Failed";
  if (status === "canceled") return "Cancelled";
  if (status === "pending") return "Order Placed";
  return null;
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  if (!isValidWebhookSecret(searchParams.get("secret"))) {
    return NextResponse.json({ error: "Invalid webhook credential." }, { status: 401 });
  }

  try {
    const event = await request.json();
    const type = event.type;
    const providerOrderId = event.data?.order?.id || event.data?.shipment?.order_id || event.data?.order_id;
    if (!providerOrderId) {
      return NextResponse.json({ error: "Webhook payload has no Printful order ID." }, { status: 400 });
    }

    const update = {};
    const status = mapPrintfulStatus(type, event.data?.order?.status);
    if (status) update.status = status;

    const shipment = event.data?.shipment || event.data?.shipments?.[0] || event.data?.order?.shipments?.[0];
    const trackingNumber = shipment?.tracking_number;
    const trackingUrl = shipment?.tracking_url;
    if (trackingNumber) update.tracking_number = trackingNumber;
    if (trackingUrl) update.tracking_url = trackingUrl;

    if (status === "POD Submission Failed") {
      update.fulfillment_error = event.data?.order?.status || "Printful reported an order failure.";
    } else if (status) {
      update.fulfillment_error = null;
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const { data, error } = await createAdminClient()
      .from("orders")
      .update(update)
      .eq("pod_order_id", String(providerOrderId))
      .select("id");

    if (error) throw error;
    if (!data?.length) {
      return NextResponse.json({ error: "No matching store order was found." }, { status: 404 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Printful webhook processing error:", error);
    return NextResponse.json({ error: error.message || "Could not process Printful webhook." }, { status: 500 });
  }
}
