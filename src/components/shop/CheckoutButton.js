"use client";

export default function CheckoutButton({ item }) {
  const handlePayment = async () => {
    const email = prompt("Enter your email for receipt:");
    if (!email) return;

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
    if (!data.success) return alert("Failed to initialize checkout.");

    const options = {
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: "After The Silence",
      description: item.title,
      order_id: data.orderId,
      prefill: { email },
      handler: function (response) {
        alert(`Payment Successful! Payment ID: ${response.razorpay_payment_id}`);
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return (
    <button
      onClick={handlePayment}
      className="bg-black text-white dark:bg-white dark:text-black py-2 px-4 rounded font-semibold w-full"
    >
      Buy Now
    </button>
  );
}