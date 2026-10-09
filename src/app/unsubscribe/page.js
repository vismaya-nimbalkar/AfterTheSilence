"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!email) {
      setStatus("error");
      setMessage("Invalid unsubscribe link.");
      return;
    }

    async function handleUnsubscribe() {
      try {
        const res = await fetch("/api/newsletter/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          setMessage("You have been successfully unsubscribed from the newsletter.");
        } else {
          setStatus("error");
          setMessage(data.error || "Failed to unsubscribe.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    }

    handleUnsubscribe();
  }, [email]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-2xl border border-black/10 p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">Unsubscribe</h1>
        {status === "loading" && <p className="opacity-60">Processing your unsubscribe request...</p>}
        {status === "success" && <p className="text-green-600 font-medium">{message}</p>}
        {status === "error" && <p className="text-red-500 font-medium">{message}</p>}
      </div>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center">Loading...</main>}>
      <UnsubscribeContent />
    </Suspense>
  );
}