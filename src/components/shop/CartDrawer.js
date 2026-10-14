"use client";

import { useCart } from "@/src/context/CartContext";
import Link from "next/link";

export default function CartDrawer() {
  const { cart, removeFromCart, updateQuantity, subtotal, isOpen, setIsOpen, previewMode } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-over Drawer */}
      <div className="relative z-10 w-full max-w-md bg-light dark:bg-dark text-dark dark:text-[#f5f5f3] h-full shadow-2xl flex flex-col justify-between p-6 sm:p-8">
        <div>
          <div className="flex items-center justify-between pb-6 border-b border-dark/10 dark:border-light/10">
            <h2 className="text-2xl font-bold">Your Cart</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-2xl opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="py-16 text-center opacity-60 text-sm">
              Your cart is currently empty.
            </div>
          ) : (
            <div className="space-y-6 mt-6 max-h-[60vh] overflow-y-auto pr-2">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 items-center border-b border-dark/10 dark:border-light/10 pb-4"
                >
                  {item.images?.[0] && (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="w-16 h-16 object-cover rounded-xl border border-dark/10"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{item.title}</h3>
                    <p className="text-xs opacity-60">₹{item.price}</p>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-md border border-dark/20 flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-md border border-dark/20 flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-xs text-red-500 opacity-70 hover:opacity-100"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="pt-6 border-t border-dark/10 dark:border-light/10 space-y-4">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>

            <Link
              href={`/checkout${previewMode ? "?preview=1" : ""}`}
              onClick={() => setIsOpen(false)}
              className="block w-full py-3.5 bg-dark text-light dark:bg-light dark:text-dark rounded-full font-bold text-center text-sm hover:opacity-80 transition-opacity"
            >
              Proceed to Checkout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}