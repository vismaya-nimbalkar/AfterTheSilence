"use client";

import { useState } from "react";
import { useConfirmDialog } from "@/src/components/Admin/ConfirmDialog";

export default function CheckoutButton({ item }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const { alert, dialog } = useConfirmDialog();

  const handlePayment = async (event) => {
    event.preventDefault();
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [item],
        customerEmail: email,
        shippingAddress: {
          name: "Customer",
          line1: "123 Main St",
          city: "Mumbai",
          state: "MH",
          country: "IN",
          zip: "400001",
        },
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      setEmailOpen(false);
      await alert(data.error || "Failed to initialize checkout.", "Checkout could not start");
      return;
    }

    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: "After The Silence",
      description: item.title,
      order_id: data.orderId,
      prefill: { email },
      handler: async function (response) {
        setEmailOpen(false);
        await alert(`Payment ID: ${response.razorpay_payment_id}`, "Payment successful");
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return (
    <>
      <button
        onClick={() => setEmailOpen(true)}
        className="bg-black text-white dark:bg-white dark:text-black py-2 px-4 rounded font-semibold w-full"
      >
        Buy Now
      </button>
      {emailOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark/50 p-4 backdrop-blur-sm">
          <form onSubmit={handlePayment} className="w-full max-w-md space-y-5 rounded-2xl border border-dark/10 bg-white p-6 shadow-2xl dark:border-light/10 dark:bg-zinc-900 sm:p-7">
            <div>
              <h2 className="text-lg font-semibold">Enter your email</h2>
              <p className="mt-2 text-sm opacity-70">We’ll use this address for your order receipt.</p>
            </div>
            <label className="block text-sm font-medium">
              Email address
              <input
                type="email"
                autoFocus
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-dark/15 bg-transparent px-4 py-3 outline-none focus:ring-2 focus:ring-dark/10 dark:border-light/15"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEmailOpen(false)} className="rounded-xl border border-dark/15 px-4 py-2.5 text-sm font-medium dark:border-light/15">Cancel</button>
              <button type="submit" className="rounded-xl bg-dark px-4 py-2.5 text-sm font-semibold text-white dark:bg-light dark:text-dark">Continue to payment</button>
            </div>
          </form>
        </div>
      )}
      {dialog}
    </>
  );
}