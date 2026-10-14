"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/src/context/CartContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutClient({ preview }) {
  const { cart, subtotal, clearCart } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [phoneCountrySearch, setPhoneCountrySearch] = useState("");
  const [phoneCountryIso, setPhoneCountryIso] = useState("IN");
  const [phoneCountryOpen, setPhoneCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [pinLookup, setPinLookup] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  const phoneCountryRef = useRef(null);
  const stateDropdownRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    line1: "",
    city: "",
    state: "",
    zip: "",
    country: "IN",
  });

  const phoneCountry = useMemo(
    () => countries.find((country) => country.isoCode === phoneCountryIso),
    [countries, phoneCountryIso]
  );
  const filteredPhoneCountries = useMemo(() => {
    const query = phoneCountrySearch.trim().toLowerCase();
    return countries.filter((country) =>
      `${country.name} ${country.phonecode}`.toLowerCase().includes(query)
    );
  }, [countries, phoneCountrySearch]);
  const filteredStates = useMemo(() => {
    const query = form.state.trim().toLowerCase();
    return states.filter((state) => state.name.toLowerCase().includes(query));
  }, [form.state, states]);

  useEffect(() => {
    function closeDropdowns(event) {
      if (!phoneCountryRef.current?.contains(event.target)) setPhoneCountryOpen(false);
      if (!stateDropdownRef.current?.contains(event.target)) setStateOpen(false);
    }

    document.addEventListener("mousedown", closeDropdowns);
    return () => document.removeEventListener("mousedown", closeDropdowns);
  }, []);

  useEffect(() => {
    fetch("/api/location/options")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load countries.");
        setCountries(data.countries || []);
      })
      .catch((error) => setLocationError(error.message));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/location/options?country=IN", {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load states.");
        setStates(data.states || []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setLocationError(error.message);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const pin = form.zip.trim();
    if (!/^\d{6}$/.test(pin)) {
      setPinLookup("");
      return;
    }

    const controller = new AbortController();
    setPinLookup("Looking up PIN code...");
    const timeout = setTimeout(() => {
      fetch(`/api/location/pincode?pin=${encodeURIComponent(pin)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "PIN lookup service is unavailable.");

          setForm((current) => ({
            ...current,
            city: data.city || current.city,
            state: data.state || current.state,
          }));
          setPinLookup(`Location filled from PIN ${pin}.`);
        })
        .catch((error) => {
          if (error.name !== "AbortError") setPinLookup(error.message);
        });
    }, 500);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [form.zip]);

  const fullPhoneNumber = `${phoneCountry?.phonecode || ""} ${phoneNumber}`.trim();
  const checkoutTotal = promoApplied?.totalAmount ?? subtotal;

  useEffect(() => {
    setPromoApplied(null);
    setPromoError("");
  }, [subtotal]);

  const applyPromoCode = async () => {
    setPromoChecking(true);
    setPromoError("");
    setPromoApplied(null);
    try {
      const response = await fetch("/api/promotions/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput, subtotal }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not apply this promo code.");
      setPromoApplied(data);
      setPromoInput(data.code);
    } catch (error) {
      setPromoError(error.message);
    } finally {
      setPromoChecking(false);
    }
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Your cart is empty.");

    setSubmitting(true);

    try {
      const formattedItems = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Razorpay SDK failed to load. Check your internet connection.");
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: formattedItems,
          promoCode: promoApplied?.code || "",
          preview,
          customerEmail: form.email,
          shippingAddress: {
            name: form.name,
            line1: form.line1,
            city: form.city,
            state: form.state,
            state_code: states.find((state) => state.name === form.state)?.isoCode || form.state,
            country: "IN",
            zip: form.zip,
            phone: fullPhoneNumber,
          },
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to start checkout.");

      const keyToUse = data.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!keyToUse) {
        throw new Error("Razorpay Key ID missing. Please check .env.local file.");
      }

      const options = {
        key: keyToUse,
        amount: data.amount,
        currency: data.currency,
        name: "After The Silence",
        description: "Merchandise Purchase",
        order_id: data.orderId,
        prefill: {
          name: form.name,
          email: form.email,
          contact: fullPhoneNumber,
        },
        handler: async function (response) {
          try {
            const verifyRes = await fetch("/api/checkout/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                items: formattedItems,
                customerEmail: form.email,
                shippingAddress: {
                  name: form.name,
                  line1: form.line1,
                  city: form.city,
                  state: form.state,
                  state_code: states.find((state) => state.name === form.state)?.isoCode || form.state,
                  country: "IN",
                  zip: form.zip,
                  phone: fullPhoneNumber,
                },
                totalAmount: subtotal,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
              throw new Error(verifyData.error || "Payment verification failed.");
            }

            clearCart();
            router.push(`/shop/confirmation?orderId=${verifyData.orderId}&method=razorpay${preview ? "&preview=1" : ""}`);
          } catch (verifyErr) {
            alert(`Verification Error: ${verifyErr.message}`);
          }
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
          },
        },
        theme: { color: "#000000" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        alert(`Payment Failed: ${resp.error.description}`);
        setSubmitting(false);
      });

      rzp.open();
    } catch (err) {
      alert(`Checkout Error: ${err.message}`);
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <main className="min-h-[60vh] max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
        <p className="text-sm opacity-60 mb-8">Add some products from the shop first.</p>
        <Link
          href={`/shop${preview ? "?preview=1" : ""}`}
          className="inline-block px-6 py-3 bg-dark text-light dark:bg-light dark:text-dark rounded-full font-bold text-sm hover:opacity-80 transition-opacity"
        >
          Return to Shop
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto px-6 py-16">
      <Link
        href="/shop"
        className="text-xs opacity-60 hover:opacity-100 transition-opacity mb-8 inline-block"
      >
        ← Back to Shop
      </Link>

      <h1 className="text-4xl font-bold mb-10">Checkout</h1>
      {preview && (
        <p className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          Admin preview checkout uses live Razorpay and normal fulfillment. Completing checkout will charge your payment method and create a real order.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Contact & Shipping Address */}
        <div className="lg:col-span-7 space-y-8">
          <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-6">
            {/* 1. Contact Information */}
            <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-6 space-y-4">
              <h2 className="text-lg font-bold mb-2">1. Contact Information</h2>
              <div>
                <label className="block text-xs font-medium opacity-70 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Jane Doe"
                  className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium opacity-70 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="jane@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium opacity-70 mb-1">Phone Number</label>
                  <div className="relative" ref={phoneCountryRef}>
                    <div className="flex w-full rounded-xl border border-dark/10 dark:border-light/10 bg-transparent focus-within:ring-1 focus-within:ring-dark dark:focus-within:ring-light">
                      <button
                        type="button"
                        aria-label={`Phone country code: ${phoneCountry?.name || "Select country"}`}
                        aria-expanded={phoneCountryOpen}
                        onClick={() => {
                          setPhoneCountryOpen((open) => !open);
                          setPhoneCountrySearch("");
                        }}
                        className="flex shrink-0 items-center gap-2 rounded-l-xl px-3 text-sm hover:bg-dark/5 dark:hover:bg-light/5"
                      >
                        <span aria-hidden="true">{phoneCountry?.flag || "🌐"}</span>
                        <span>{phoneCountry?.phonecode || "+..."}</span>
                        <span aria-hidden="true" className="text-xs opacity-60">⌄</span>
                      </button>
                      <input
                        type="tel"
                        required
                        autoComplete="tel-national"
                        inputMode="tel"
                        aria-label="Phone number"
                        placeholder="9876543210"
                        className="w-full min-w-0 rounded-r-xl border-0 bg-transparent px-3 py-3 text-sm focus:outline-none focus:ring-0"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                    {phoneCountryOpen && (
                      <div className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[85vw] rounded-xl border border-dark/10 dark:border-light/10 bg-white p-2 shadow-xl dark:bg-zinc-900">
                        <input
                          type="search"
                          autoFocus
                          aria-label="Search phone countries"
                          placeholder="Search country or code"
                          className="mb-2 w-full rounded-lg border border-dark/10 bg-transparent px-3 py-2 text-sm dark:border-light/10"
                          value={phoneCountrySearch}
                          onChange={(e) => setPhoneCountrySearch(e.target.value)}
                        />
                        <div role="listbox" aria-label="Phone country codes" className="max-h-60 overflow-y-auto">
                          {filteredPhoneCountries.length ? filteredPhoneCountries.map((country) => (
                            <button
                              key={country.isoCode}
                              type="button"
                              role="option"
                              aria-selected={country.isoCode === phoneCountryIso}
                              onClick={() => {
                                setPhoneCountryIso(country.isoCode);
                                setPhoneCountryOpen(false);
                                setPhoneCountrySearch("");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-dark/5 dark:hover:bg-light/10"
                            >
                              <span aria-hidden="true">{country.flag}</span>
                              <span className="flex-1">{country.name}</span>
                              <span className="opacity-60">{country.phonecode}</span>
                            </button>
                          )) : (
                            <p className="px-3 py-2 text-sm opacity-60">No countries found.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Shipping Address */}
            <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-6 space-y-4">
              <h2 className="text-lg font-bold mb-2">2. Shipping Address</h2>
              <div>
                <label className="block text-xs font-medium opacity-70 mb-1">Address Line 1</label>
                <input
                  type="text"
                  required
                  placeholder="House/Flat No., Street Name"
                  className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none"
                  value={form.line1}
                  onChange={(e) => setForm({ ...form, line1: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium opacity-70 mb-1">City</label>
                  <input
                    type="text"
                    required
                    autoComplete="address-level2"
                    placeholder="Enter your city"
                    className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium opacity-70 mb-1">State</label>
                  <div className="relative" ref={stateDropdownRef}>
                    <div className="flex w-full rounded-xl border border-dark/10 dark:border-light/10 bg-transparent focus-within:ring-1 focus-within:ring-dark dark:focus-within:ring-light">
                      <input
                        type="text"
                        required
                        autoComplete="address-level1"
                        placeholder="Type to search or enter a state"
                        aria-expanded={stateOpen}
                        aria-controls="shipping-state-options"
                        className="w-full min-w-0 rounded-l-xl border-0 bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-0"
                        value={form.state}
                        onFocus={() => setStateOpen(true)}
                        onChange={(e) => {
                          setForm({ ...form, state: e.target.value });
                          setStateOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setStateOpen(false);
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Show state options"
                        aria-expanded={stateOpen}
                        onClick={() => setStateOpen((open) => !open)}
                        className="shrink-0 px-3 text-sm opacity-70 hover:opacity-100"
                      >
                        ⌄
                      </button>
                    </div>
                    {stateOpen && (
                      <div
                        id="shipping-state-options"
                        role="listbox"
                        aria-label="State options"
                        className="absolute left-0 top-full z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-dark/10 bg-white p-1 shadow-xl dark:border-light/10 dark:bg-zinc-900"
                      >
                        {filteredStates.length ? filteredStates.map((state) => (
                          <button
                            key={state.isoCode}
                            type="button"
                            role="option"
                            aria-selected={state.name === form.state}
                            onClick={() => {
                              setForm({ ...form, state: state.name });
                              setStateOpen(false);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-dark/5 dark:hover:bg-light/10"
                          >
                            {state.name}
                          </button>
                        )) : (
                          <p className="px-3 py-2 text-sm opacity-60">
                            No matches. You can keep your typed state.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium opacity-70 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    required
                    placeholder="6-digit PIN code"
                    className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none"
                    value={form.zip}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        zip: e.target.value,
                        city: "",
                        state: "",
                      }))
                    }
                  />
                </div>
              </div>
              {pinLookup && (
                <p role="status" className="text-xs opacity-70">{pinLookup}</p>
              )}
              {locationError && (
                <p role="alert" className="text-xs text-red-700 dark:text-red-300">{locationError}</p>
              )}
              <p className="text-xs opacity-50">Shipping is currently available within India only.</p>
            </div>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-6 sticky top-28 bg-light/30 dark:bg-dark/30 space-y-6">
            <h2 className="text-xl font-bold">Order Summary</h2>

            <div>
              <label htmlFor="promo-code" className="mb-2 block text-xs font-semibold opacity-70">Promo code</label>
              <div className="flex gap-2">
                <input
                  id="promo-code"
                  value={promoInput}
                  onChange={(event) => {
                    setPromoInput(event.target.value.toUpperCase());
                    setPromoApplied(null);
                    setPromoError("");
                  }}
                  maxLength={32}
                  placeholder="Enter code"
                  className="min-w-0 flex-1 rounded-xl border border-dark/10 bg-transparent px-3 py-2.5 text-sm dark:border-light/10"
                />
                <button
                  type="button"
                  disabled={promoChecking || !promoInput.trim()}
                  onClick={applyPromoCode}
                  className="rounded-xl border border-dark/20 px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
                >
                  {promoChecking ? "Checking..." : promoApplied ? "Apply again" : "Apply"}
                </button>
              </div>
              {promoError && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{promoError}</p>}
              {promoApplied && <p role="status" className="mt-2 text-xs text-green-700 dark:text-green-300">{promoApplied.code} applied — save ₹{promoApplied.discountAmount}.</p>}
            </div>

            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center gap-4 text-sm">
                  <div className="flex items-center gap-3">
                    {item.images?.[0] && (
                      <img
                        src={item.images[0]}
                        alt={item.title}
                        className="w-12 h-12 object-cover rounded-lg border border-dark/10"
                      />
                    )}
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs opacity-60">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="font-semibold">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-dark/10 dark:border-light/10 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-70">Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Shipping</span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              {promoApplied && (
                <div className="flex justify-between text-green-700 dark:text-green-300">
                  <span>Discount ({promoApplied.code})</span>
                  <span>−₹{promoApplied.discountAmount}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-dark/10 dark:border-light/10">
                <span>Total</span>
                <span>₹{checkoutTotal}</span>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="w-full py-4 bg-dark text-light dark:bg-light dark:text-dark rounded-full font-bold text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Processing..." : `Pay ₹${checkoutTotal} via Razorpay`}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}