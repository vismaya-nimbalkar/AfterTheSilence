"use client";

import { useCart } from "@/src/context/CartContext";

export default function CartQuantityControl({ product, addQuantity = 1 }) {
  const { cart, addToCart, updateQuantity } = useCart();
  const quantity = cart.find((item) => item.id === product.id)?.quantity || 0;

  return (
    <div className="flex min-w-0 flex-col items-center">
      {quantity > 0 ? (
        <div className="flex min-h-11 w-full items-center justify-center gap-2">
          <button
            type="button"
            aria-label={`Decrease quantity of ${product.title}`}
            onClick={() => updateQuantity(product.id, -1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dark/20 text-sm dark:border-light/20"
          >
            −
          </button>
          <span aria-live="polite" className="min-w-12 text-center text-xs font-semibold">
            In cart: {quantity}
          </span>
          <button
            type="button"
            aria-label={`Increase quantity of ${product.title}`}
            onClick={() => updateQuantity(product.id, 1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dark/20 text-sm dark:border-light/20"
          >
            +
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => addToCart(product, addQuantity)}
          className="min-h-11 w-full rounded-xl border border-dark/20 px-2 text-xs font-semibold transition-colors hover:bg-dark/5 dark:border-light/20 dark:hover:bg-light/5"
        >
          Add to Cart
        </button>
      )}
      {quantity > 0 && (
        <p role="status" className="mt-1 text-center text-[11px] text-green-700 dark:text-green-300">
          Added to your cart
        </p>
      )}
    </div>
  );
}
