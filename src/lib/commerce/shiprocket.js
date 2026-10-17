const API_BASE = "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function requireShiprocketConfig() {
  const missing = ["SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD", "SHIPROCKET_PICKUP_LOCATION", "SHIPROCKET_PICKUP_POSTCODE"]
    .filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Shiprocket is not configured. Set ${missing.join(", ")} on the server.`);
  }
}

async function login() {
  requireShiprocketConfig();
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result.token) {
    throw new Error(result.message || "Shiprocket authentication failed.");
  }
  cachedToken = result.token;
  cachedTokenExpiresAt = Date.now() + 8 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

async function getToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;
  return login();
}

async function shiprocketRequest(path, { method = "GET", body, retry = true } = {}) {
  requireShiprocketConfig();
  const token = await getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));

  if (response.status === 401 && retry) {
    cachedToken = null;
    cachedTokenExpiresAt = 0;
    return shiprocketRequest(path, { method, body, retry: false });
  }
  if (!response.ok) {
    const detail = result.message || result.errors?.message || result.error || `HTTP ${response.status}`;
    throw new Error(`Shiprocket request failed: ${detail}`);
  }
  return result;
}

export function isNormalOrderItem(item) {
  return item?.order_type === "normal"
    || !item?.order_type;
}

export function getPackageDetails(items) {
  const packageItems = (Array.isArray(items) ? items : []).filter(isNormalOrderItem);
  if (!packageItems.length) return null;

  let weight = 0;
  let length = 0;
  let width = 0;
  let height = 0;
  for (const item of packageItems) {
    const quantity = Number(item.quantity);
    const itemWeight = Number(item.shipping_weight_kg);
    const itemLength = Number(item.shipping_length_cm);
    const itemWidth = Number(item.shipping_width_cm);
    const itemHeight = Number(item.shipping_height_cm);
    if (![quantity, itemWeight, itemLength, itemWidth, itemHeight].every(Number.isFinite)
      || quantity < 1 || itemWeight <= 0 || itemLength <= 0 || itemWidth <= 0 || itemHeight <= 0) {
      throw new Error(`Shipping weight and package dimensions are missing for "${item.title}".`);
    }

    weight += itemWeight * quantity;
    length = Math.max(length, itemLength);
    width = Math.max(width, itemWidth);
    height += itemHeight * quantity;
  }

  return {
    weight: Math.max(0.1, Number(weight.toFixed(3))),
    length: Math.max(1, Math.ceil(length)),
    breadth: Math.max(1, Math.ceil(width)),
    height: Math.max(1, Math.ceil(height)),
    items: packageItems,
  };
}

export async function getCheapestCourier({ pickupPostcode, deliveryPostcode, packageDetails, declaredValue, isReturn = false }) {
  requireShiprocketConfig();
  const params = new URLSearchParams({
    pickup_postcode: String(pickupPostcode || process.env.SHIPROCKET_PICKUP_POSTCODE),
    delivery_postcode: String(deliveryPostcode),
    weight: String(packageDetails.weight),
    cod: "0",
    length: String(packageDetails.length),
    breadth: String(packageDetails.breadth),
    height: String(packageDetails.height),
    declared_value: String(Number(declaredValue) || 0),
    is_return: isReturn ? "1" : "0",
  });
  const result = await shiprocketRequest(`/courier/serviceability/?${params.toString()}`);

  const couriers = result.data?.available_courier_companies
    || result.data?.courier_companies
    || result.available_courier_companies
    || [];
  const cheapest = couriers
    .map((courier) => ({
      ...courier,
      quotedRate: Number(courier.freight_charge ?? courier.rate),
    }))
    .filter((courier) => Number.isFinite(courier.quotedRate) && courier.quotedRate >= 0 && courier.courier_company_id)
    .sort((left, right) => left.quotedRate - right.quotedRate)[0];

  if (!cheapest) throw new Error("Shiprocket has no available courier for this PIN code and package.");
  return cheapest;
}

function getAddressFields(address) {
  const nameParts = String(address.name || "").trim().split(/\s+/);
  const firstName = nameParts.shift() || "";
  return {
    firstName,
    lastName: nameParts.join(" "),
  };
}

function shiprocketItems(items) {
  return items.map((item) => ({
    name: item.title,
    sku: String(item.product_id),
    units: Number(item.quantity),
    selling_price: Number(item.price),
    discount: 0,
    tax: 0,
    hsn: "",
  }));
}

function extractShipment(result) {
  const data = result.payload || result.data || result;
  const shipmentId = data.shipment_id || data.shipmentId || result.shipment_id || result.shipmentId;
  const shiprocketOrderId = data.order_id || data.orderId || result.order_id || result.orderId;
  if (!shipmentId || !shiprocketOrderId) throw new Error("Shiprocket did not return its order and shipment references.");
  return { data, shipmentId, shiprocketOrderId };
}

async function assignCheapestCourier(shipmentId, courierId) {
  const result = await shiprocketRequest("/courier/assign/awb", {
    method: "POST",
    body: { shipment_id: shipmentId, courier_id: courierId },
  });
  const data = result.response?.data || result.data || result;
  if (data.status === false || data.status === "false" || result.status_code >= 400) {
    throw new Error(data.message || result.message || "Shiprocket could not assign the selected courier.");
  }
  if (!data.awb_code && !data.awb) throw new Error("Shiprocket assigned no AWB for this shipment.");
  return data;
}

export async function createOutboundShipment({ order, items, shippingAmount = 0, kind = "outbound" }) {
  const packageDetails = getPackageDetails(items);
  if (!packageDetails) return null;
  const address = order.shipping_address;
  const name = getAddressFields(address);
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const courier = await getCheapestCourier({
    pickupPostcode: process.env.SHIPROCKET_PICKUP_POSTCODE,
    deliveryPostcode: address.zip,
    packageDetails,
    declaredValue: subtotal,
  });
  const result = await shiprocketRequest("/orders/create/adhoc", {
    method: "POST",
    body: {
      order_id: `${order.id}-${kind}`,
      order_date: new Date(order.created_at || Date.now()).toISOString().slice(0, 19).replace("T", " "),
      pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
      billing_customer_name: name.firstName,
      billing_last_name: name.lastName,
      billing_address: address.line1,
      billing_address_2: "",
      billing_city: address.city,
      billing_pincode: address.zip,
      billing_state: address.state,
      billing_country: "India",
      billing_email: order.customer_email,
      billing_phone: address.phone,
      shipping_is_billing: true,
      order_items: shiprocketItems(items),
      payment_method: "Prepaid",
      shipping_charges: Number(shippingAmount),
      sub_total: Number(subtotal.toFixed(2)),
      length: packageDetails.length,
      breadth: packageDetails.breadth,
      height: packageDetails.height,
      weight: packageDetails.weight,
    },
  });
  const { data, shipmentId, shiprocketOrderId } = extractShipment(result);
  let assignment;
  try {
    assignment = await assignCheapestCourier(shipmentId, courier.courier_company_id);
  } catch (error) {
    await cancelShiprocketOrder(shiprocketOrderId).catch((cancelError) => {
      console.error("Could not cancel an unassigned Shiprocket order:", cancelError);
    });
    throw error;
  }
  const assignedData = assignment.response?.data || assignment;
  const awbCode = assignedData.awb_code || assignedData.awb || data.awb_code || null;

  return {
    kind,
    shiprocket_order_id: String(shiprocketOrderId),
    shipment_id: String(shipmentId),
    awb_code: awbCode ? String(awbCode) : null,
    courier_name: assignedData.courier_name || courier?.courier_name || null,
    tracking_url: awbCode ? `https://www.shiprocket.in/shipment-tracking/` : null,
    status: "Order Placed",
    items,
  };
}

export async function createReturnShipment({ order, items, shipmentKind = "return" }) {
  requireShiprocketConfig();
  const missingReturnDetails = ["SHIPROCKET_RETURN_ADDRESS", "SHIPROCKET_RETURN_CITY", "SHIPROCKET_RETURN_STATE", "SHIPROCKET_RETURN_PHONE"]
    .filter((key) => !process.env[key]);
  if (missingReturnDetails.length) {
    throw new Error(`Shiprocket return pickup is not configured. Set ${missingReturnDetails.join(", ")} on the server.`);
  }
  const packageDetails = getPackageDetails(items);
  const customer = order.shipping_address;
  const name = getAddressFields(customer);
  const courier = await getCheapestCourier({
    pickupPostcode: customer.zip,
    deliveryPostcode: process.env.SHIPROCKET_PICKUP_POSTCODE,
    packageDetails,
    declaredValue: items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0),
    isReturn: true,
  });
  const result = await shiprocketRequest("/orders/create/return", {
    method: "POST",
    body: {
      order_id: `${order.id}-${shipmentKind}-${Date.now()}`,
      order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
      pickup_customer_name: name.firstName,
      pickup_last_name: name.lastName,
      pickup_address: customer.line1,
      pickup_address_2: "",
      pickup_city: customer.city,
      pickup_state: customer.state,
      pickup_country: "India",
      pickup_pincode: customer.zip,
      pickup_email: order.customer_email,
      pickup_phone: customer.phone,
      shipping_customer_name: process.env.SHIPROCKET_RETURN_NAME || process.env.SHIPROCKET_PICKUP_LOCATION,
      shipping_last_name: "",
      shipping_address: process.env.SHIPROCKET_RETURN_ADDRESS,
      shipping_address_2: "",
      shipping_city: process.env.SHIPROCKET_RETURN_CITY,
      shipping_state: process.env.SHIPROCKET_RETURN_STATE,
      shipping_country: "India",
      shipping_pincode: process.env.SHIPROCKET_PICKUP_POSTCODE,
      shipping_email: process.env.SHIPROCKET_RETURN_EMAIL || process.env.SHIPROCKET_EMAIL,
      shipping_phone: process.env.SHIPROCKET_RETURN_PHONE,
      order_items: shiprocketItems(items),
      payment_method: "Prepaid",
      sub_total: Number(items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0).toFixed(2)),
      length: packageDetails.length,
      breadth: packageDetails.breadth,
      height: packageDetails.height,
      weight: packageDetails.weight,
    },
  });
  const { data, shipmentId, shiprocketOrderId } = extractShipment(result);
  let assignment;
  try {
    assignment = await assignCheapestCourier(shipmentId, courier.courier_company_id);
  } catch (error) {
    await cancelShiprocketOrder(shiprocketOrderId).catch((cancelError) => {
      console.error("Could not cancel an unassigned Shiprocket return:", cancelError);
    });
    throw error;
  }
  const assignedData = assignment.response?.data || assignment;
  const awbCode = assignedData.awb_code || assignedData.awb || data.awb_code || null;

  return {
    kind: shipmentKind,
    shiprocket_order_id: String(shiprocketOrderId),
    shipment_id: String(shipmentId),
    awb_code: awbCode ? String(awbCode) : null,
    courier_name: assignedData.courier_name || courier.courier_name || null,
    tracking_url: awbCode ? "https://www.shiprocket.in/shipment-tracking/" : null,
    status: "Return Pickup Created",
    items,
  };
}

export async function cancelShiprocketOrder(shiprocketOrderId) {
  if (!shiprocketOrderId) return null;
  const id = Number(shiprocketOrderId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("The Shiprocket order reference is invalid; cannot cancel it automatically.");
  }
  const result = await shiprocketRequest("/orders/cancel", {
    method: "POST",
    body: { ids: [id] },
  });
  if (result.status === false || result.status === "false" || result.status_code >= 400) {
    throw new Error(result.message || "Shiprocket could not cancel this shipment. If the courier has picked it up, initiate a return pickup instead.");
  }
  return result;
}
