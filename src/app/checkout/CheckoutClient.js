"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/src/context/CartContext";
import { useRouter } from "next/navigation";
import PrivacyNotice from "@/src/components/PrivacyNotice";
import BackLink from "@/src/components/BackLink";

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
  const {
    cart,
    subtotal,
    clearCart,
    removeFromCart,
    updateQuantity,
    availabilityLoading,
    availabilityChecked,
    availabilityError,
    refreshCartAvailability,
    setPreviewMode,
  } = useCart();
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
  const [availablePromotions, setAvailablePromotions] = useState([]);
  const [promotionsLoading, setPromotionsLoading] = useState(true);
  const [promotionsError, setPromotionsError] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState(null);
  const phoneCountryRef = useRef(null);
  const stateDropdownRef = useRef(null);
  const noticeCloseButtonRef = useRef(null);
  const hasUnavailableItem = cart.some(
    (item) => item.is_in_stock === false || item.is_published === false
  );
  const checkoutBlocked =
    availabilityLoading || !availabilityChecked || Boolean(availabilityError) || hasUnavailableItem;

  useEffect(() => {
    setPreviewMode(preview);
  }, [preview, setPreviewMode]);

  useEffect(() => {
    if (!checkoutNotice) return undefined;

    noticeCloseButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setCheckoutNotice(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [checkoutNotice]);

  useEffect(() => {
    if (cart.length > 0) refreshCartAvailability();
  }, [cart.length, refreshCartAvailability]);

  useEffect(() => {
    fetch("/api/promotions", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load available coupons.");
        setAvailablePromotions(data.promotions || []);
      })
      .catch((error) => setPromotionsError(error.message))
      .finally(() => setPromotionsLoading(false));
  }, []);

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

  const applyPromoCode = async (code = promoInput) => {
    const requestedCode = String(code || "").trim().toUpperCase();
    setPromoInput(requestedCode);
    setPromoChecking(true);
    setPromoError("");
    setPromoApplied(null);
    try {
      const response = await fetch("/api/promotions/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: requestedCode, subtotal }),
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
    if (cart.length === 0) {
      setCheckoutNotice({
        title: "Your cart is empty",
        message: "Add a product to your cart before continuing to checkout.",
      });
      return;
    }
    if (checkoutBlocked) {
      setCheckoutNotice({
        title: "Checkout is unavailable",
        message: hasUnavailableItem
          ? "Remove out-of-stock items from your cart before checking out."
          : availabilityError || "Please wait while product availability is checked.",
      });
      return;
    }

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
            setCheckoutNotice({
              title: "Payment verification failed",
              message: verifyErr.message,
            });
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
        setCheckoutNotice({
          title: "Payment failed",
          message: resp.error.description || "Your payment could not be completed. Please try again.",
        });
        setSubmitting(false);
      });

      rzp.open();
    } catch (err) {
      if (/out of stock|unavailable/i.test(err.message || "")) {
        refreshCartAvailability();
      }
      setCheckoutNotice({
        title: "Checkout couldn't be completed",
        message: err.message || "Something went wrong. Please try again.",
      });
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <main className="min-h-[60vh] max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
        <p className="text-sm opacity-60 mb-8">Add some products from the shop first.</p>
        <BackLink href={`/shop${preview ? "?preview=1" : ""}`}>Back to Shop</BackLink>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto px-6 py-16">
      {checkoutNotice && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCheckoutNotice(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="checkout-notice-title"
            aria-describedby="checkout-notice-message"
            className="w-full max-w-xl overflow-hidden rounded-3xl bg-white text-zinc-800 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100"
          >
            <div className="flex gap-4 px-6 py-7 sm:px-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg font-bold text-red-600 dark:bg-red-950 dark:text-red-300" aria-hidden="true">
                !
              </div>
              <div className="min-w-0">
                <h2 id="checkout-notice-title" className="text-lg font-semibold tracking-tight">
                  {checkoutNotice.title}
                </h2>
                <p id="checkout-notice-message" className="mt-2 break-words text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {checkoutNotice.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end border-t border-zinc-200 px-6 py-3 dark:border-zinc-700 sm:px-8">
              <button
                ref={noticeCloseButtonRef}
                type="button"
                onClick={() => setCheckoutNotice(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-fuchsia-700 transition-colors hover:bg-fuchsia-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 dark:text-fuchsia-300 dark:hover:bg-fuchsia-950/50"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="mb-8">
        <BackLink href="/shop">Back to Shop</BackLink>
      </div>

      <h1 className="text-4xl font-bold mb-10">Checkout</h1>
      {preview && (
        <p className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          Admin preview checkout uses live Razorpay and normal fulfillment. Completing checkout will charge your payment method and create a real order.
        </p>
      )}
      {availabilityError && (
        <div role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          <p>{availabilityError}</p>
          <button
            type="button"
            onClick={refreshCartAvailability}
            className="mt-2 font-semibold underline"
          >
            Check availability again
          </button>
        </div>
      )}
      {hasUnavailableItem && (
        <div role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          Out-of-stock or unavailable items must be removed from your cart before checkout.
        </div>
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
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold opacity-70">Available coupons</p>
                {promotionsLoading ? (
                  <p className="text-xs opacity-60">Loading coupons...</p>
                ) : promotionsError ? (
                  <p role="alert" className="text-xs text-red-700 dark:text-red-300">{promotionsError}</p>
                ) : availablePromotions.length ? (
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {availablePromotions.map((promotion) => (
                      <button
                        key={promotion.code}
                        type="button"
                        onClick={() => applyPromoCode(promotion.code)}
                        disabled={promoChecking}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-dark/15 px-3 py-2 text-left transition-colors hover:bg-dark/5 disabled:opacity-50 dark:border-light/15 dark:hover:bg-light/5"
                      >
                        <span>
                          <span className="block text-sm font-semibold">{promotion.code}</span>
                          <span className="block text-xs opacity-60">
                            {promotion.discount_type === "percent"
                              ? `${promotion.discount_value}% off${promotion.max_discount_amount ? ` (up to ₹${promotion.max_discount_amount})` : ""}`
                              : `₹${promotion.discount_value} off`}
                            {Number(promotion.minimum_order_amount) > 0 && ` · Min. order ₹${promotion.minimum_order_amount}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold">
                          {promoChecking && promoInput === promotion.code
                            ? "Applying..."
                            : promoApplied?.code === promotion.code
                              ? "Applied"
                              : "Apply"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs opacity-60">No coupons are available right now.</p>
                )}
              </div>
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
                    <div className="min-w-0">
                      <p className="font-semibold">{item.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.title}`}
                          onClick={() => updateQuantity(item.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-dark/20 text-xs dark:border-light/20"
                        >
                          −
                        </button>
                        <span className="min-w-5 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.title}`}
                          onClick={() => updateQuantity(item.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-dark/20 text-xs dark:border-light/20"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="ml-1 text-xs text-red-600 underline dark:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                      {(item.is_in_stock === false || item.is_published === false) && (
                        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                          {item.is_published === false ? "No longer available" : "Out of stock"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-semibold">₹{item.price * item.quantity}</span>
                  </div>
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
              disabled={submitting || checkoutBlocked}
              className="w-full py-4 bg-dark text-light dark:bg-light dark:text-dark rounded-full font-bold text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {submitting
                ? "Processing..."
                : hasUnavailableItem
                  ? "Remove unavailable items to continue"
                  : availabilityLoading || !availabilityChecked
                    ? "Checking product availability..."
                    : availabilityError
                      ? "Availability check required"
                      : `Pay ₹${checkoutTotal} via Razorpay`}
            </button>
            <PrivacyNotice action="placing your order" />
          </div>
        </div>
      </div>
    </main>
  );
}