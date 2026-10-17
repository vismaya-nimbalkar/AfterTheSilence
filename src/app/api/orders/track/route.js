import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim();

    if (!query) {
      return NextResponse.json(
        { success: false, error: "Please enter an order ID or email address." },
        { status: 400 }
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);

    let dbQuery = supabase.from("orders").select("*").eq("is_preview", false);

    if (isUuid) {
      dbQuery = dbQuery.or(`id.eq.${query},customer_email.ilike.${query}`);
    } else {
      dbQuery = dbQuery.ilike("customer_email", query);
    }

    const { data: orders, error } = await dbQuery.order("created_at", {
      ascending: false,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const orderIds = (orders || []).map((order) => order.id);
    let shipmentsByOrder = new Map(orderIds.map((id) => [id, []]));
    if (orderIds.length) {
      const { data: shipments, error: shipmentsError } = await supabase
        .from("order_shipments")
        .select("id, order_id, kind, awb_code, courier_name, tracking_url, status, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });
      if (shipmentsError) throw shipmentsError;
      for (const shipment of shipments || []) shipmentsByOrder.get(shipment.order_id)?.push(shipment);
    }

    return NextResponse.json({
      success: true,
      orders: (orders || []).map((order) => {
        const publicOrder = { ...order };
        delete publicOrder.shiprocket_error;
        return {
          ...publicOrder,
          shipments: shipmentsByOrder.get(order.id) || [],
        };
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}