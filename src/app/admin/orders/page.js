"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import BackLink from "@/src/components/BackLink";

const ORDER_FILTER_STATUSES = [
  "Payment Pending",
  "Order Placed",
  "In Production",
  "POD Order Submission Pending",
  "POD Order Created",
  "POD Submission Failed",
  "POD Setup Required",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Delivery Exception",
  "Cancelled",
];

const EDITABLE_ORDER_STATUSES = [
  "Payment Pending",
  "Order Placed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Delivery Exception",
  "Cancelled",
];

function CustomStatusSelect({ currentStatus, onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-dark/20 dark:border-light/20 bg-white dark:bg-zinc-900 text-xs font-semibold hover:bg-dark/5 dark:hover:bg-light/5 transition-colors shadow-sm disabled:opacity-50 min-w-[180px] justify-between"
      >
        <span>{currentStatus || "Order Placed"}</span>
        <svg
          className={`w-3.5 h-3.5 opacity-60 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-56 rounded-2xl border border-dark/10 dark:border-light/10 bg-white dark:bg-zinc-900 p-2 shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
          <div className="space-y-1">
            {EDITABLE_ORDER_STATUSES.map((st) => {
              const isSelected = st === currentStatus;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    onSelect(st);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-left transition-colors ${
                    isSelected
                      ? "bg-dark text-light dark:bg-light dark:text-dark font-bold"
                      : "hover:bg-dark/5 dark:hover:bg-light/5 text-dark/80 dark:text-light/80"
                  }`}
                >
                  <span>{st}</span>
                  {isSelected && <span className="text-xs font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("All");
  const [updatingId, setUpdatingId] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundAmount, setRefundAmount] = useState("");

  // Custom Delete Modal State
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const fetchOrders = (showLoading = true) => {
    if (showLoading) setLoading(true);
    return fetch("/api/admin/orders", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load orders.");
        return data;
      })
      .then((data) => {
        setOrders(data.orders || []);
        setLoadError("");
        setLoading(false);
      })
      .catch((error) => {
        setLoadError(error.message);
        setLoading(false);
      });
  };

  const handleRefreshRefundStatus = async (orderId) => {
    setUpdatingId(orderId);
    try {
      await fetchOrders(false);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(false), 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (orderId, newStatus, trackingNum, trackingProvider) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          status: newStatus,
          trackingNumber: trackingNum,
          trackingProvider,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Update failed");

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: newStatus,
                tracking_number: trackingNum,
                tracking_provider: trackingProvider || o.tracking_provider || "manual",
              }
            : o
        )
      );
    } catch (err) {
      alert(`Update Error: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleQikinkAction = async (orderId, action = "submit") => {
    setUpdatingId(orderId);
    try {
      const res = await fetch("/api/admin/orders/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Qikink request failed.");
      setOrders((previous) => previous.map((order) => order.id === orderId ? data.order : order));
    } catch (error) {
      alert(`Qikink Error: ${error.message}`);
      fetchOrders();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleProcessRefund = async (event) => {
    event.preventDefault();
    if (!refundTarget) return;
    setUpdatingId(refundTarget.id);
    try {
      const response = await fetch("/api/admin/orders/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: refundTarget.id, amount: refundAmount }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Refund could not be processed.");
      setRefundTarget(null);
      setRefundAmount("");
      fetchOrders(false);
    } catch (error) {
      alert(`Refund Error: ${error.message}`);
      fetchOrders(false);
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!deleteTargetId) return;

    const orderId = deleteTargetId;
    setUpdatingId(orderId);
    setDeleteTargetId(null);

    try {
      const res = await fetch(`/api/admin/orders?orderId=${orderId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || "Deletion failed");

      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err) {
      alert(`Delete Error: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders =
    filter === "All" ? orders : orders.filter((o) => o.status === filter);

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-6 py-16">
      <div className="mb-6">
        <BackLink href="/admin">Back to Dashboard</BackLink>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
          <p className="text-sm opacity-60 mt-1">
            View, track, update status, and manage shop fulfillment.
          </p>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </p>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 border-b border-dark/10 dark:border-light/10 text-xs">
        {["All", ...ORDER_FILTER_STATUSES].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors ${
              filter === st
                ? "bg-dark text-light dark:bg-light dark:text-dark font-bold"
                : "border border-dark/10 dark:border-light/10 hover:bg-dark/5 dark:hover:bg-light/5 opacity-70"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm opacity-60">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-12 text-center text-sm opacity-60">
          No orders found for this status filter.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => {
            const isPodOrder = Boolean(order.pod_order_id) || (Array.isArray(order.items) &&
              order.items.some((item) => item.order_type === "pod" || (!item.order_type && item.pod_variant_id)));
            return (
            <div
              key={order.id}
              className="rounded-2xl border border-dark/10 dark:border-light/10 p-6 bg-white dark:bg-zinc-900/50 space-y-6 shadow-sm"
            >
              {/* Header Info */}
              <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-dark/10 dark:border-light/10">
                <div>
                  <span className="text-xs font-mono opacity-50 block">ORDER ID</span>
                  <span className="text-sm font-bold font-mono select-all">{order.id}</span>
                  {order.is_preview && (
                    <span className="mt-1 inline-block rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                      Preview test order
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-mono opacity-50 block">CUSTOMER</span>
                  <span className="text-sm font-medium">{order.customer_email}</span>
                </div>
                <div>
                  <span className="text-xs font-mono opacity-50 block">PAYMENT METHOD</span>
                  <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-md bg-dark/5 dark:bg-light/5 inline-block mt-0.5">
                    {String(order.payment_method || "unknown").replaceAll("_", " ")}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-mono opacity-50 block">TOTAL</span>
                  <span className="text-sm font-bold">₹{order.total_amount}</span>
                  {Number(order.discount_amount) > 0 && (
                    <span className="block text-[10px] opacity-60">₹{order.subtotal_amount} less ₹{order.discount_amount} ({order.promo_code})</span>
                  )}
                </div>
                {order.razorpay_payment_id && !order.is_preview && (
                  <div>
                    <span className="text-xs font-mono opacity-50 block">REFUNDED</span>
                    <span className="text-sm font-bold">₹{Number(order.refunded_amount || 0).toFixed(2)}</span>
                    {order.refund_status && <span className="ml-2 text-[10px] uppercase opacity-60">{order.refund_status}</span>}
                    {order.refund_sync_error && (
                      <span role="status" className="mt-1 block text-[10px] text-amber-700 dark:text-amber-300">
                        {order.refund_sync_error}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {order.refunds?.length > 0 && (
                <div className="rounded-xl border border-dark/10 p-4 dark:border-light/10">
                  <h4 className="mb-2 text-xs font-bold opacity-60">REFUND HISTORY</h4>
                  <div className="space-y-2">
                    {order.refunds.map((refund) => (
                      <div key={refund.id} className="flex flex-wrap justify-between gap-2 text-xs">
                        <span>₹{Number(refund.amount).toFixed(2)} · {refund.status}</span>
                        <span className="opacity-60">{refund.razorpay_refund_id || refund.error || new Date(refund.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {isPodOrder && (
                    <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-300">
                      Refunds only return payment; they do not cancel POD production or shipping. Contact the provider separately.
                    </p>
                  )}
                </div>
              )}

              {/* Items & Shipping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="text-xs font-bold opacity-60 mb-2">ITEMS</h4>
                  <div className="space-y-1">
                    {Array.isArray(order.items) &&
                      order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>
                            {item.title} × {item.quantity}
                          </span>
                          <span className="font-semibold">
                            ₹{item.price * item.quantity}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold opacity-60 mb-2">SHIPPING ADDRESS</h4>
                  {order.shipping_address ? (
                    <p className="text-xs opacity-80 leading-relaxed">
                      <strong>{order.shipping_address.name}</strong> (
                      {order.shipping_address.phone})<br />
                      {order.shipping_address.line1}, {order.shipping_address.city},{" "}
                      {order.shipping_address.state} - {order.shipping_address.zip}
                    </p>
                  ) : (
                    <p className="text-xs opacity-40">No address provided</p>
                  )}
                </div>
              </div>

              {isPodOrder && order.fulfillment_error && (
                <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-700 dark:text-red-300">
                  <p className="font-semibold">{order.pod_provider === "qikink" ? "Qikink needs attention:" : "Legacy POD fulfillment needs attention:"} {order.fulfillment_error}</p>
                  {order.pod_provider === "qikink" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() => handleQikinkAction(order.id)}
                      className="mt-3 rounded-lg border border-current px-3 py-2 font-semibold disabled:opacity-50"
                    >
                      {updatingId === order.id ? "Submitting..." : "Retry Qikink submission"}
                    </button>
                  )}
                </div>
              )}

              {/* Status Controls & Action Buttons */}
              <div className="pt-4 border-t border-dark/10 dark:border-light/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold opacity-70">Status:</span>
                  {isPodOrder ? (
                    <span className="text-xs font-semibold">{order.status || (order.pod_provider === "qikink" ? "Waiting for Qikink" : "Legacy POD order")}</span>
                  ) : (
                    <CustomStatusSelect
                      currentStatus={order.status || "Order Placed"}
                      disabled={updatingId === order.id}
                      onSelect={(st) =>
                        handleUpdateStatus(
                          order.id,
                          st,
                          order.tracking_number || ""
                        )
                      }
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {isPodOrder ? (
                    order.tracking_number ? (
                      order.tracking_url ? <a
                        href={order.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono underline"
                      >
                        {order.pod_provider === "qikink" ? "Qikink tracking" : "Legacy provider tracking"}: {order.tracking_number}
                      </a> : <span className="text-xs font-mono">{order.pod_provider === "qikink" ? "Qikink tracking" : "Legacy provider tracking"}: {order.tracking_number}</span>
                    ) : (
                      <span className="text-xs opacity-60">Tracking will appear after the provider ships the order.</span>
                    )
                  ) : (
                    <>
                      <select
                        aria-label="Tracking provider"
                        value={order.tracking_provider === "shiprocket" ? "shiprocket" : "manual"}
                        disabled={updatingId === order.id}
                        onChange={(e) => handleUpdateStatus(
                          order.id,
                          order.status,
                          order.tracking_number || "",
                          e.target.value
                        )}
                        className="px-3.5 py-2.5 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-xs focus:outline-none"
                      >
                        <option value="manual">Manual tracking</option>
                        <option value="shiprocket">Shiprocket (automatic updates)</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Tracking / AWB number..."
                        defaultValue={order.tracking_number || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (order.tracking_number || "")) {
                            handleUpdateStatus(
                              order.id,
                              order.status,
                              e.target.value,
                              order.tracking_provider === "shiprocket" ? "shiprocket" : "manual"
                            );
                          }
                        }}
                        className="px-3.5 py-2.5 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-xs focus:outline-none min-w-[160px]"
                      />
                    </>
                  )}

                  {isPodOrder && order.pod_provider === "qikink" && order.qikink_order_number && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() => handleQikinkAction(order.id, "sync")}
                      className="rounded-xl border border-dark/10 px-3.5 py-2.5 text-xs font-semibold hover:bg-dark/5 disabled:opacity-50 dark:border-light/10 dark:hover:bg-light/5"
                    >
                      {updatingId === order.id ? "Refreshing..." : "Refresh Qikink status"}
                    </button>
                  )}

                  {!isPodOrder && order.status !== "Cancelled" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={() =>
                        handleUpdateStatus(
                          order.id,
                          "Cancelled",
                          order.tracking_number || ""
                        )
                      }
                      className="px-4 py-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      Cancel Order
                    </button>
                  )}

                  {order.razorpay_payment_id && !order.is_preview && order.refund_status !== "full" && (
                    <button
                      type="button"
                      disabled={updatingId === order.id}
                      onClick={order.refund_status === "pending"
                        ? () => handleRefreshRefundStatus(order.id)
                        : () => {
                          setRefundTarget(order);
                          setRefundAmount((Number(order.total_amount) - Number(order.refunded_amount || 0)).toFixed(2));
                        }}
                      className="rounded-xl border border-amber-600/30 px-4 py-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300"
                    >
                      {updatingId === order.id
                        ? "Refreshing..."
                        : order.refund_status === "pending"
                          ? "Refresh refund status"
                          : "Issue refund"}
                    </button>
                  )}

                  {/* Permanent Delete Button */}
                  <button
                    type="button"
                    disabled={updatingId === order.id}
                    onClick={() => setDeleteTargetId(order.id)}
                    className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm whitespace-nowrap"
                  >
                    Delete Order
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={handleProcessRefund} className="w-full max-w-md space-y-5 rounded-2xl border border-dark/10 bg-white p-6 shadow-2xl dark:border-light/10 dark:bg-zinc-900">
            <div>
              <h2 className="text-xl font-bold">Confirm refund?</h2>
              <p className="mt-2 text-sm opacity-70">Order {refundTarget.id.slice(0, 8)} · Remaining refundable amount ₹{(Number(refundTarget.total_amount) - Number(refundTarget.refunded_amount || 0)).toFixed(2)}</p>
            </div>
            <label className="block text-sm font-medium">
              Refund amount (INR)
              <input
                type="number"
                required
                min="0.01"
                max={(Number(refundTarget.total_amount) - Number(refundTarget.refunded_amount || 0)).toFixed(2)}
                step="0.01"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                className="mt-2 w-full rounded-xl border border-dark/20 bg-transparent px-4 py-3"
              />
            </label>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              This sends a real refund request to Razorpay. It cannot be undone. For POD orders, this does not stop production or cancel the provider order.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" disabled={updatingId === refundTarget.id} onClick={() => setRefundTarget(null)} className="w-full rounded-lg border border-dark/20 px-3 py-2.5 text-sm">Cancel</button>
              <button type="submit" aria-label="Confirm refund" disabled={updatingId === refundTarget.id} className="w-full rounded-lg bg-amber-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{updatingId === refundTarget.id ? "Submitting..." : `Confirm refund ₹${Number(refundAmount || 0).toFixed(2)}`}</button>
            </div>
          </form>
        </div>
      )}

      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-dark/10 dark:border-light/10 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-lg font-bold">
                ⚠️
              </div>
              <h3 className="text-lg font-bold text-dark dark:text-light">
                Delete Order Permanently
              </h3>
            </div>

            <p className="text-xs text-dark/70 dark:text-light/70 leading-relaxed">
              Are you sure you want to permanently delete order{" "}
              <strong className="font-mono text-dark dark:text-light select-all">
                {deleteTargetId}
              </strong>
              ? This action cannot be undone and will erase all record of this order.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-5 py-2.5 rounded-xl border border-dark/10 dark:border-light/10 text-xs font-semibold hover:bg-dark/5 dark:hover:bg-light/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteOrder}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm"
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}