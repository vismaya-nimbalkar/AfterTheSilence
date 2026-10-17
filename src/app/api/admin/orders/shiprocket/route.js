import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { hasEditorPermission } from "@/src/lib/admin/permissions";
import {
  cancelShiprocketOrder,
  createOutboundShipment,
  createReturnShipment,
  isNormalOrderItem,
} from "@/src/lib/commerce/shiprocket";

async function getAuthorizedAdmin() {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  if (!hasEditorPermission(user, "shop")) {
    return { response: NextResponse.json({ error: "You do not have permission to manage shop orders." }, { status: 403 }) };
  }
  return { supabaseAdmin: createAdminClient() };
}

function normalizeRequestedItems(requested, orderItems) {
  if (!Array.isArray(requested) || !requested.length) throw new Error("Select at least one item and quantity.");
  if (requested.some((item) => !item || typeof item !== "object")) {
    throw new Error("Selected return items are invalid.");
  }
  const orderItemsById = new Map(orderItems.map((item) => [String(item.product_id), item]));
  return requested.map(({ product_id: productId, quantity }) => {
    const original = orderItemsById.get(String(productId));
    const units = Number(quantity);
  if (!original || !isNormalOrderItem(original) || !Number.isInteger(units) || units < 1 || units > Number(original.quantity)) {
      throw new Error("Selected return items or quantities are not part of this order.");
    }
    return { ...original, quantity: units };
  });
}

async function saveShipment(supabaseAdmin, orderId, shipment) {
  const { data, error } = await supabaseAdmin
    .from("order_shipments")
    .insert({ order_id: orderId, ...shipment })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function POST(request) {
  const { response, supabaseAdmin } = await getAuthorizedAdmin();
  if (response) return response;

  try {
    const { orderId, action, items: requestedItems, replacementItems } = await request.json();
    if (!orderId || !["retry", "cancel", "return", "exchange"].includes(action)) {
      return NextResponse.json({ error: "Choose a valid Shiprocket action and order." }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, items, shipping_address, customer_email, total_amount, shipping_amount, status, created_at")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const shippableItems = Array.isArray(order.items) ? order.items.filter(isNormalOrderItem) : [];
    if (!shippableItems.length) {
      return NextResponse.json({ error: "This order has no Shiprocket-fulfilled products." }, { status: 409 });
    }

    if (action === "retry") {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("order_shipments")
        .select("id")
        .eq("order_id", order.id)
        .eq("kind", "outbound")
        .limit(1);
      if (existingError) throw existingError;
      if (existing?.length) return NextResponse.json({ error: "A Shiprocket shipment already exists for this order." }, { status: 409 });
      const shipment = await createOutboundShipment({ order, items: shippableItems, shippingAmount: order.shipping_amount });
      const saved = await saveShipment(supabaseAdmin, order.id, shipment);
      const { error: clearError } = await supabaseAdmin.from("orders").update({ shiprocket_error: null }).eq("id", order.id);
      if (clearError) throw clearError;
      return NextResponse.json({ success: true, shipment: saved });
    }

    if (action === "cancel") {
      const { data: outboundShipments, error: shipmentError } = await supabaseAdmin
        .from("order_shipments")
        .select("id, shiprocket_order_id, status")
        .eq("order_id", order.id)
        .eq("kind", "outbound")
        .order("created_at", { ascending: false })
        .limit(1);
      if (shipmentError) throw shipmentError;
      const shipment = outboundShipments?.[0];
      if (shipment?.shiprocket_order_id) await cancelShiprocketOrder(shipment.shiprocket_order_id);

      if (shipment) {
        const { error: shipmentUpdateError } = await supabaseAdmin
          .from("order_shipments")
          .update({ status: "Cancelled" })
          .eq("id", shipment.id);
        if (shipmentUpdateError) throw shipmentUpdateError;
      }
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({ status: "Cancelled" })
        .eq("id", order.id);
      if (updateError) throw updateError;
      return NextResponse.json({ success: true, status: "Cancelled" });
    }

    const { data: existingReverse, error: reverseLookupError } = await supabaseAdmin
      .from("order_shipments")
      .select("id")
      .eq("order_id", order.id)
      .in("kind", ["return", "exchange"])
      .limit(1);
    if (reverseLookupError) throw reverseLookupError;
    if (existingReverse?.length) {
      return NextResponse.json({ error: "A return or exchange pickup has already been created for this order." }, { status: 409 });
    }

    if (action === "exchange" && (!Array.isArray(replacementItems) || !replacementItems.length)) {
      return NextResponse.json({ error: "Select at least one replacement product for an exchange." }, { status: 400 });
    }
    const returnItems = normalizeRequestedItems(requestedItems, order.items || []);
    let replacementOrderItems = [];
    if (action === "exchange") {
      if (replacementItems.some((item) => !item || typeof item.product_id !== "string")) {
        return NextResponse.json({ error: "Select valid replacement products." }, { status: 400 });
      }
      const productIds = [...new Set(replacementItems.map((item) => item.product_id))];
      const { data: products, error: productsError } = await supabaseAdmin
        .from("products")
        .select("id, title, price, is_published, is_in_stock, shipping_weight_kg, shipping_length_cm, shipping_width_cm, shipping_height_cm")
        .in("id", productIds);
      if (productsError) throw productsError;
      if (products?.length !== productIds.length || products.some((product) => !product.is_published || product.is_in_stock === false)) {
        return NextResponse.json({ error: "The selected replacement products are unavailable." }, { status: 400 });
      }
      const productMap = new Map(products.map((product) => [String(product.id), product]));
      replacementOrderItems = replacementItems.map((item) => {
        const product = productMap.get(String(item.product_id));
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
          throw new Error("Enter a valid replacement quantity.");
        }
        return {
          product_id: product.id,
          title: product.title,
          price: Number(product.price),
          quantity,
          order_type: "normal",
          shipping_weight_kg: Number(product.shipping_weight_kg),
          shipping_length_cm: Number(product.shipping_length_cm),
          shipping_width_cm: Number(product.shipping_width_cm),
          shipping_height_cm: Number(product.shipping_height_cm),
        };
      });
    }

    const reverseShipment = await createReturnShipment({
      order,
      items: returnItems,
      shipmentKind: "return",
    });
    const savedReverse = await saveShipment(supabaseAdmin, order.id, reverseShipment);
    if (action === "return") return NextResponse.json({ success: true, shipments: [savedReverse] });

    let replacementWarning = null;
    let savedReplacement = null;
    try {
      const replacement = await createOutboundShipment({
        order,
        items: replacementOrderItems,
        shippingAmount: 0,
        kind: "exchange",
      });
      savedReplacement = await saveShipment(supabaseAdmin, order.id, replacement);
    } catch (error) {
      replacementWarning = error.message;
      console.error(`Shiprocket exchange shipment failed for order ${order.id}:`, error);
    }
    return NextResponse.json({
      success: true,
      shipments: [savedReverse, ...(savedReplacement ? [savedReplacement] : [])],
      warning: replacementWarning,
    });
  } catch (error) {
    console.error("Admin Shiprocket order action failed:", error);
    return NextResponse.json({ error: error.message || "Could not process the Shiprocket action." }, { status: 502 });
  }
}
