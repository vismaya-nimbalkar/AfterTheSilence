import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { isQikinkReadyForCheckout, syncQikinkOrder } from "@/src/lib/commerce/qikink";

export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  const receivedBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);
  return Boolean(
    secret &&
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isQikinkReadyForCheckout()) {
    return NextResponse.json({ error: "Live Qikink credentials are not configured." }, { status: 503 });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("pod_provider", "qikink")
      .in("status", ["POD Order Created", "In Production", "Shipped", "Out for Delivery", "Delivery Exception"])
      .not("qikink_order_number", "is", null)
      .order("qikink_checked_at", { ascending: true, nullsFirst: true })
      .limit(20);
    if (error) throw error;

    let synced = 0;
    const failures = [];
    const batches = [];
    for (let index = 0; index < (orders || []).length; index += 10) {
      batches.push(orders.slice(index, index + 10));
    }
    for (const batch of batches) {
      const results = await Promise.all(batch.map(async (order) => {
        try {
          await syncQikinkOrder(order, supabaseAdmin);
          return { orderId: order.id, success: true };
        } catch (syncError) {
          console.error(`Scheduled Qikink sync failed for order ${order.id}:`, syncError);
          const { error: attemptError } = await supabaseAdmin
            .from("orders")
            .update({ qikink_checked_at: new Date().toISOString() })
            .eq("id", order.id);
          if (attemptError) {
            console.error(`Could not record Qikink sync attempt for order ${order.id}:`, attemptError);
          }
          return { orderId: order.id, error: syncError.message || "Qikink sync failed." };
        }
      }));
      synced += results.filter((result) => result.success).length;
      failures.push(...results.filter((result) => !result.success));
    }

    if (failures.length) {
      return NextResponse.json(
        { error: "Some Qikink orders could not be synchronized.", synced, failures },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, synced });
  } catch (error) {
    console.error("Scheduled Qikink sync failed:", error);
    return NextResponse.json({ error: error.message || "Could not synchronize Qikink orders." }, { status: 500 });
  }
}
