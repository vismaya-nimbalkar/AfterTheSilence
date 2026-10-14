"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const method = searchParams.get("method");
  const preview = searchParams.get("preview") === "1";

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-20 text-center">
      <div className="w-16 h-16 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
        ✓
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
        Order Received!
      </h1>
      <p className="text-sm sm:text-base opacity-70 mb-8 max-w-md mx-auto">
        {preview
          ? "Your payment was processed and this order will be fulfilled normally."
          : "We've sent a confirmation email with all details to your address."}
      </p>

      {orderId && (
        <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-6 bg-white/50 dark:bg-zinc-900/50 mb-10 text-left space-y-3">
          <div className="flex justify-between items-center text-xs opacity-60">
            <span>ORDER NUMBER</span>
            <span>STATUS</span>
          </div>
          <div className="flex justify-between items-center font-mono text-sm font-bold">
            <span className="select-all">{orderId}</span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              {method === "offline_mail" ? "Pending Cheque/DD Clearance" : "Processing"}
            </span>
          </div>

          {method === "offline_mail" && (
            <div className="mt-4 pt-4 border-t border-dark/10 dark:border-light/10 text-xs space-y-2 leading-relaxed opacity-80">
              <p className="font-bold">Mail-in Instructions Reminder:</p>
              <p>Mail your Cheque/DD payable to <strong>After The Silence</strong> to:</p>
              <p className="font-mono bg-dark/5 dark:bg-light/5 p-3 rounded-lg">
                After The Silence Commerce Dept.<br />
                123 Executive Suite, FC Road<br />
                Mumbai, Maharashtra - 400001, India
              </p>
              <p>Write your Order ID (<strong>{orderId}</strong>) on a note inside the envelope.</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href={`/shop/track`}
          className="px-6 py-3 rounded-full border border-dark/20 dark:border-light/20 text-xs font-semibold hover:bg-dark/5 dark:hover:bg-light/5 transition-colors"
        >
          Track Order Progress
        </Link>
        <Link
          href={`/shop${preview ? "?preview=1" : ""}`}
          className="px-6 py-3 rounded-full bg-dark text-light dark:bg-light dark:text-dark text-xs font-semibold hover:opacity-80 transition-opacity"
        >
          Continue Shopping
        </Link>
      </div>
    </main>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm opacity-60">Loading confirmation...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}