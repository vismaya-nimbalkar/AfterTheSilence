import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getCheapestCourier, getPackageDetails } from "@/src/lib/commerce/shiprocket";

export async function POST(request) {
  try {
    const { items, deliveryPostcode } = await request.json();
    const postcode = String(deliveryPostcode || "").trim();
    if (!/^\d{6}$/.test(postcode) || !Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: "Enter a valid six-digit delivery PIN code." }, { status: 400 });
    }

    const quantities = new Map();
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.product_id || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return NextResponse.json({ error: "The cart contains an invalid product or quantity." }, { status: 400 });
      }
      quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + quantity);
    }

    const { data: products, error } = await createAdminClient()
      .from("products")
      .select("id, title, price, is_published, shipping_weight_kg, shipping_length_cm, shipping_width_cm, shipping_height_cm")
      .in("id", [...quantities.keys()]);
    if (error) throw error;
    if (!products || products.length !== quantities.size || products.some((product) => !product.is_published)) {
      return NextResponse.json({ error: "A product in your cart is unavailable. Refresh your cart and try again." }, { status: 400 });
    }

    const parcelItems = products.map((product) => ({
      ...product,
      order_type: "normal",
      quantity: quantities.get(product.id),
    }));
    const packageDetails = getPackageDetails(parcelItems);
    if (!packageDetails) return NextResponse.json({ shippingAmount: 0, courierName: null });

    const declaredValue = parcelItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const courier = await getCheapestCourier({
      deliveryPostcode: postcode,
      packageDetails,
      declaredValue,
    });
    return NextResponse.json({
      shippingAmount: Number(courier.quotedRate.toFixed(2)),
      courierName: courier.courier_name || null,
    });
  } catch (error) {
    console.error("Shiprocket shipping quote error:", error);
    return NextResponse.json({ error: error.message || "Could not calculate Shiprocket shipping." }, { status: 502 });
  }
}
