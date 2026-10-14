const TOKEN_URL_PATH = "/api/token";
const ORDER_URL_PATH = "/api/order/create";
const ORDER_LIST_PATH = "/api/order/list";
const ORDER_REFERENCE_PREFIX = "ATS_";

export function isQikinkReadyForCheckout() {
  return Boolean(
    process.env.QIKINK_CLIENT_ID &&
    process.env.QIKINK_CLIENT_SECRET &&
    (process.env.QIKINK_ENV === "sandbox" || process.env.QIKINK_ENV === "live") &&
    (process.env.NODE_ENV !== "production" || process.env.QIKINK_ENV === "live")
  );
}

function getQikinkConfig() {
  const environment = process.env.QIKINK_ENV;
  if (process.env.NODE_ENV === "production" && environment !== "live") {
    throw new Error("Set QIKINK_ENV=live with live Qikink credentials before processing production orders.");
  }
  const baseUrl = environment === "live"
    ? "https://api.qikink.com"
    : environment === "sandbox"
      ? "https://sandbox.qikink.com"
      : null;
  const clientId = process.env.QIKINK_CLIENT_ID;
  const clientSecret = process.env.QIKINK_CLIENT_SECRET;

  if (!baseUrl) throw new Error("Set QIKINK_ENV to either sandbox or live.");
  if (!clientId || !clientSecret) {
    throw new Error("Qikink automation is not configured: set QIKINK_CLIENT_ID and QIKINK_CLIENT_SECRET.");
  }

  return { baseUrl, clientId, clientSecret };
}

async function getAccessToken(config) {
  const cached = globalThis.qikinkAccessToken;
  if (cached?.clientId === config.clientId && cached.expiresAt > Date.now() + 30_000) {
    return cached.value;
  }
  // Qikink replaces the prior token on token issuance; reuse one in-flight request per runtime.
  if (globalThis.qikinkTokenPromise) return globalThis.qikinkTokenPromise;

  const tokenPromise = (async () => {
    const body = new URLSearchParams({
      ClientId: config.clientId,
      client_secret: config.clientSecret,
    });
    const response = await fetch(`${config.baseUrl}${TOKEN_URL_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();

    if (!response.ok || !result.Accesstoken) {
      throw new Error(result.error || `Qikink authentication failed (${response.status}).`);
    }

    const expiresIn = Number(result.expires_in) || 3600;
    globalThis.qikinkAccessToken = {
      clientId: config.clientId,
      value: result.Accesstoken,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return result.Accesstoken;
  })();
  globalThis.qikinkTokenPromise = tokenPromise;
  try {
    return await tokenPromise;
  } finally {
    if (globalThis.qikinkTokenPromise === tokenPromise) globalThis.qikinkTokenPromise = null;
  }
}

async function qikinkRequest(path, { method = "GET", body, retryUnauthorized = true } = {}) {
  const config = getQikinkConfig();
  const accessToken = await getAccessToken(config);
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      ClientId: config.clientId,
      Accesstoken: accessToken,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();

  if ((response.status === 401 || response.status === 403) && retryUnauthorized) {
    globalThis.qikinkAccessToken = null;
    return qikinkRequest(path, { method, body, retryUnauthorized: false });
  }

  if (
    !response.ok ||
    (result.status_code && String(result.status_code) !== "200") ||
    result.success === false
  ) {
    throw new Error(result.error || result.message || `Qikink request failed (${response.status}).`);
  }
  return result;
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return { first_name: parts.shift() || "", last_name: parts.join(" ") };
}

function splitAddress(address) {
  const value = String(address || "").trim();
  return {
    address1: value.slice(0, 90),
    address2: value.slice(90),
  };
}

function createQikinkReference(orderId) {
  const compactId = String(orderId).replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${ORDER_REFERENCE_PREFIX}${compactId}`.slice(0, 15);
}

function buildQikinkOrder(order) {
  const items = Array.isArray(order.items)
    ? order.items.filter((item) => item.order_type === "pod")
    : [];
  if (!items.length) throw new Error("This order has no Qikink POD items.");

  for (const item of items) {
    if (!item.qikink_sku || item.qikink_sku.length > 50) {
      throw new Error(`Qikink SKU is missing or invalid for "${item.title}". Add its SKU from Qikink My Products.`);
    }
    if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
      throw new Error(`Qikink quantity for "${item.title}" must be a positive whole number.`);
    }
  }
  if (!order.shipping_address || !order.customer_email) {
    throw new Error("The customer shipping information is missing from this POD order.");
  }

  const name = splitName(order.shipping_address.name);
  const address = splitAddress(order.shipping_address.line1);
  return {
    order_number: order.qikink_order_number || createQikinkReference(order.id),
    qikink_shipping: 1,
    gateway: "Prepaid",
    total_order_value: items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    ),
    line_items: items.map((item) => ({
      search_from_my_products: 1,
      quantity: Number(item.quantity),
      price: Number(item.price),
      sku: item.qikink_sku,
    })),
    shipping_address: {
      ...name,
      ...address,
      phone: String(order.shipping_address.phone || ""),
      email: String(order.customer_email),
      city: String(order.shipping_address.city || ""),
      zip: String(order.shipping_address.zip || ""),
      province: String(order.shipping_address.state || ""),
      country_code: "IN",
    },
  };
}

async function findQikinkOrder(orderNumber) {
  const params = new URLSearchParams({ order_reference_no: orderNumber });
  const result = await qikinkRequest(`${ORDER_LIST_PATH}?${params}`);
  const data = result.data;
  const records = Array.isArray(data) ? data : data ? [data] : [];
  const matchingOrder = records.find((record) => {
    const reference = record.number || record.order_number || record.order_reference_no;
    return reference === orderNumber || reference?.endsWith(`_${orderNumber}`);
  });
  return matchingOrder || (records.length === 1 ? records[0] : null);
}

function mapQikinkStatus(statusValue) {
  const status = String(statusValue || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");
  if (status === "delivered") return "Delivered";
  if (status.includes("out for delivery")) return "Out for Delivery";
  if (["picked up", "in transit", "manifested", "dispatched"].includes(status)) return "Shipped";
  if (["cancelled"].includes(status)) return "Cancelled";
  if (["returned", "partially returned", "rto initiated", "lost", "exception"].includes(status)) {
    return "Delivery Exception";
  }
  if (["to be printed", "partially printed", "printed", "stitched/qc", "dispatch ready"].includes(status)) {
    return "In Production";
  }
  if (["live", "live oos", "open", "on hold"].includes(status)) return "POD Order Created";
  return null;
}

async function saveQikinkOrderState(order, providerOrder, supabaseAdmin) {
  const update = {
    pod_provider: "qikink",
    qikink_order_id: String(providerOrder.order_id || ""),
    qikink_order_number: order.qikink_order_number || providerOrder.number,
    qikink_checked_at: new Date().toISOString(),
    pod_order_id: String(providerOrder.order_id || order.pod_order_id || ""),
    fulfillment_error: null,
  };
  const status = mapQikinkStatus(providerOrder.status);
  if (status) update.status = status;
  if (providerOrder.shipping?.awb) {
    update.tracking_number = String(providerOrder.shipping.awb);
    update.tracking_provider = "qikink";
  }
  if (providerOrder.shipping?.tracking_link) {
    update.tracking_url = String(providerOrder.shipping.tracking_link);
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(update)
    .eq("id", order.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function submitQikinkOrder(order, supabaseAdmin) {
  const requestBody = buildQikinkOrder(order);
  const existing = await findQikinkOrder(requestBody.order_number);
  if (existing) return saveQikinkOrderState(order, existing, supabaseAdmin);

  const created = await qikinkRequest(ORDER_URL_PATH, {
    method: "POST",
    body: requestBody,
  });
  if (!created.order_id) throw new Error("Qikink created no order ID.");

  const providerOrder = {
    order_id: created.order_id,
    number: requestBody.order_number,
    status: "Live",
  };
  return saveQikinkOrderState(
    { ...order, qikink_order_number: requestBody.order_number },
    providerOrder,
    supabaseAdmin
  );
}

export async function syncQikinkOrder(order, supabaseAdmin) {
  if (order.pod_provider !== "qikink" || !order.qikink_order_number) {
    throw new Error("This order is not linked to a Qikink order.");
  }
  const providerOrder = await findQikinkOrder(order.qikink_order_number);
  if (!providerOrder) throw new Error("Qikink could not find this order reference.");
  return saveQikinkOrderState(order, providerOrder, supabaseAdmin);
}

export async function recordQikinkFailure(orderId, message, supabaseAdmin) {
  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status: "POD Submission Failed", fulfillment_error: message })
    .eq("id", orderId);
  if (error) console.error("Could not record Qikink submission failure:", error);
}
