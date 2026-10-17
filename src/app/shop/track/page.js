"use client";

import { useEffect, useState } from "react";
import PrivacyNotice from "@/src/components/PrivacyNotice";
import BackLink from "@/src/components/BackLink";

const TRACKING_STEPS_ONLINE = [
  "Order Placed",
  "In Production",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

const TRACKING_STEPS_OFFLINE = [
  "Pending Cheque/DD Clearance",
  "Order Placed",
  "In Production",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

function OrderProgressBar({ status, isOffline }) {
  const steps = isOffline ? TRACKING_STEPS_OFFLINE : TRACKING_STEPS_ONLINE;

  if (status === "Cancelled") {
    return (
      <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold text-center">
        ❌ This order has been cancelled.
      </div>
    );
  }

  if (status === "Delivery Exception") {
    return (
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold text-center">
        The carrier reported a delivery exception. Please contact us for help.
      </div>
    );
  }

  const currentStepIndex = steps.indexOf(status) !== -1 ? steps.indexOf(status) : 0;
  
  // Calculate exact horizontal offset so lines start and end precisely at the centers of the outer circles
  const stepOffsetPercent = 100 / steps.length / 2;
  const progressPercent = (currentStepIndex / (steps.length - 1)) * 100;

  return (
    <div className="py-6 my-2">
      <div className="relative">
        {/* Background Track Line - Aligned exactly from first circle center to last circle center */}
        <div 
          className="absolute top-4 h-1 bg-slate-300 dark:bg-zinc-600 z-0 rounded-full" 
          style={{
            left: `${stepOffsetPercent}%`,
            right: `${stepOffsetPercent}%`,
          }}
        />

        {/* Active Green Progress Line */}
        <div
          className="absolute top-4 h-1 bg-green-500 transition-all duration-500 z-0 rounded-full"
          style={{
            left: `${stepOffsetPercent}%`,
            width: `calc((100% - ${stepOffsetPercent * 2}%) * ${progressPercent / 100})`,
          }}
        />

        {/* Steps Grid */}
        <div
          className="relative z-10 grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
          }}
        >
          {steps.map((step, idx) => {
            const isCompleted = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div key={step} className="flex flex-col items-center text-center">
                {/* Circle Element */}
                <div
                  className={`relative z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? "bg-green-500 text-white shadow-md"
                      : "bg-slate-300 dark:bg-zinc-600 border-2 border-slate-300 dark:border-zinc-600"
                  } ${isCurrent ? "ring-4 ring-green-500/30 scale-110" : ""}`}
                >
                  {isCompleted ? (
                    /* White Tick inside Green Circle */
                    <svg
                      className="w-4.5 h-4.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    /* Incomplete state - clear visible inner dot */
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-zinc-500" />
                  )}
                </div>

                {/* Status Text Label underneath */}
                <span
                  className={`mt-3 text-[10px] sm:text-xs leading-tight font-medium transition-colors max-w-[90px] ${
                    isCurrent
                      ? "text-green-600 dark:text-green-400 font-bold opacity-100"
                      : isCompleted
                      ? "text-dark dark:text-light font-semibold opacity-90"
                      : "opacity-50"
                  }`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch(
        `/api/orders/track?query=${encodeURIComponent(query.trim())}`
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to retrieve order details.");
      }

      setOrders(data.orders || []);
      setHasSearched(true);
    } catch (err) {
      setErrorMessage(err.message || "Error searching for orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasSearched || !query.trim()) return undefined;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/track?query=${encodeURIComponent(query.trim())}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Could not refresh order tracking.");
        }
        setOrders(data.orders || []);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(error.message);
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [hasSearched, query]);

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-6 py-16">
      <div className="mb-8">
        <BackLink href="/shop">Back to Shop</BackLink>
      </div>

      <h1 className="text-4xl font-bold mb-3">Track Your Order</h1>
      <p className="text-sm opacity-60 mb-10">
        Enter your Order ID or the email address used during checkout.
      </p>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          type="text"
          required
          placeholder="Order ID or email address..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-5 py-3.5 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3.5 bg-dark text-light dark:bg-light dark:text-dark rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {loading ? "Searching..." : "Track"}
        </button>
      </form>
      <div className="mb-8">
        <PrivacyNotice action="searching for your order" />
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Results Section */}
      {orders !== null && (
        <div className="space-y-8">
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-10 text-center text-sm opacity-60">
              No orders found matching "{query}".
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-dark/10 dark:border-light/10 p-6 space-y-6 bg-white/50 dark:bg-zinc-900/50"
              >
                <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-dark/10 dark:border-light/10">
                  <div>
                    <span className="text-xs font-mono opacity-50 block">ORDER ID</span>
                    <span className="text-sm font-bold font-mono select-all">{order.id}</span>
                  </div>
                  <div>
                    <span className="text-xs font-mono opacity-50 block">DATE</span>
                    <span className="text-sm">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-mono opacity-50 block font-semibold">STATUS</span>
                    <span className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold bg-dark/10 dark:bg-light/10">
                      {order.status || "Processing"}
                    </span>
                  </div>
                </div>

                {/* Interactive Status Bar */}
                <OrderProgressBar
                  status={order.status || "Order Placed"}
                  isOffline={order.payment_method === "offline_mail"}
                />

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
                  <p className="font-semibold">Refund status</p>
                  <p className="mt-1 text-xs opacity-70">
                    {order.refund_status === "pending"
                      ? "Your refund is being processed."
                      : order.refund_status === "full"
                        ? "Your refund has been processed."
                        : order.refund_status === "partial"
                          ? "A partial refund has been processed."
                          : "No refund has been recorded for this order."}
                    {Number(order.refunded_amount) > 0 && (
                      <> Amount refunded: ₹{Number(order.refunded_amount).toFixed(2)}.</>
                    )}
                  </p>
                </div>

                {/* Items List */}
                <div className="space-y-2 pt-2 border-t border-dark/10 dark:border-light/10">
                  <span className="text-xs font-semibold opacity-60">ITEMS</span>
                  {Array.isArray(order.items) &&
                    order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>
                          {item.title} × {item.quantity}
                        </span>
                        <span className="font-semibold">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                </div>

                {/* Shipping / Tracking Info */}
                {(order.shipments?.length > 0 || order.tracking_provider === "shiprocket" || (order.tracking_number && order.tracking_provider !== "manual" && order.tracking_provider !== "shiprocket")) && (
                  <div className="pt-4 border-t border-dark/10 dark:border-light/10 text-xs">
                    <span className="mb-2 block font-semibold opacity-60">SHIPMENT TRACKING</span>
                    <div className="space-y-2">
                      {(order.shipments || []).map((shipment) => (
                        <div key={shipment.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="capitalize">{shipment.kind} shipment:</span>
                          {shipment.awb_code && (
                            <a
                              href={shipment.tracking_url || "https://www.shiprocket.in/shipment-tracking/"}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono font-bold underline"
                            >
                              {shipment.awb_code}
                            </a>
                          )}
                          {shipment.courier_name && <span>{shipment.courier_name}</span>}
                          <span className="opacity-60">{shipment.status}</span>
                        </div>
                      ))}
                      {order.tracking_number && order.tracking_provider === "shiprocket" && !order.shipments?.length && (
                        <div>
                          <span className="opacity-60">Shiprocket tracking: </span>
                          {order.tracking_url
                            ? <a href={order.tracking_url} target="_blank" rel="noreferrer" className="font-mono font-bold underline">{order.tracking_number}</a>
                            : <span className="font-mono font-bold">{order.tracking_number}</span>}
                        </div>
                      )}
                      {order.tracking_number && order.tracking_provider !== "manual" && order.tracking_provider !== "shiprocket" && (
                        <div>
                          <span className="opacity-60">Carrier tracking: </span>
                          {order.tracking_url ? (
                            <a href={order.tracking_url} target="_blank" rel="noreferrer" className="font-mono font-bold underline">
                              {order.tracking_number}
                            </a>
                          ) : (
                            <span className="font-mono font-bold">{order.tracking_number}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}