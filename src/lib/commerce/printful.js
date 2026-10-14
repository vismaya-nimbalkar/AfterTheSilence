const PRINTFUL_API_URL = "https://api.printful.com";

function getPrintfulToken() {
  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) throw new Error("Printful automation is not configured: PRINTFUL_API_TOKEN is missing.");
  return token;
}

async function printfulRequest(path, options = {}) {
  const response = await fetch(`${PRINTFUL_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getPrintfulToken()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();

  if (!response.ok || result.code >= 400) {
    throw new Error(result.error?.message || result.result || `Printful request failed (${response.status}).`);
  }
  return result.result;
}

export async function submitPrintfulOrder(order, supabaseAdmin) {
  const podItems = Array.isArray(order.items)
    ? order.items.filter((item) => item.order_type === "pod")
    : [];

  if (!podItems.length) {
    throw new Error("This order has no print-on-demand items.");
  }

  for (const item of podItems) {
    if (!item.pod_variant_id || !item.print_file_url) {
      throw new Error(`POD setup is incomplete for "${item.title}": add its Printful variant and public print-file URL.`);
    }
    if (!/^\d+$/.test(String(item.pod_variant_id))) {
      throw new Error(`Printful variant ID for "${item.title}" must be numeric.`);
    }
  }

  let printfulOrderId = order.pod_order_id;
  if (!printfulOrderId) {
    const draft = await printfulRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        external_id: order.id,
        recipient: {
          name: order.shipping_address.name,
          email: order.customer_email,
          phone: order.shipping_address.phone,
          address1: order.shipping_address.line1,
          city: order.shipping_address.city,
          state_code: order.shipping_address.state_code,
          country_code: "IN",
          zip: order.shipping_address.zip,
        },
        items: podItems.map((item) => ({
          variant_id: Number(item.pod_variant_id),
          quantity: item.quantity,
          files: [{ url: item.print_file_url }],
          retail_price: String(item.price),
        })),
      }),
    });

    printfulOrderId = draft.id;
    if (!printfulOrderId) throw new Error("Printful created no order ID.");

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ pod_order_id: String(printfulOrderId), status: "POD Order Created", fulfillment_error: null })
      .eq("id", order.id);
    if (error) throw error;
  }

  const { error: resetError } = await supabaseAdmin
    .from("orders")
    .update({ status: "POD Order Created", fulfillment_error: null })
    .eq("id", order.id);
  if (resetError) throw resetError;

  const confirmedOrder = await printfulRequest(`/orders/${encodeURIComponent(printfulOrderId)}/confirm`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from("orders")
    .update({ fulfillment_error: null })
    .eq("id", order.id)
    .select()
    .single();
  if (updateError) throw updateError;

  if (confirmedOrder?.status === "inprocess") {
    const { error: statusError } = await supabaseAdmin
      .from("orders")
      .update({ status: "In Production" })
      .eq("id", order.id)
      .neq("status", "Shipped")
      .neq("status", "Delivered");
    if (statusError) throw statusError;
    updatedOrder.status = "In Production";
  }

  return updatedOrder;
}

export async function recordPrintfulFailure(orderId, message, supabaseAdmin) {
  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status: "POD Submission Failed", fulfillment_error: message })
    .eq("id", orderId);
  if (error) {
    console.error("Could not record Printful submission failure:", error);
  }
}
