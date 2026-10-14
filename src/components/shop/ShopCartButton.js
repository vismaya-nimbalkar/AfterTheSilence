"use client";

import { usePathname } from "next/navigation";
import { useCart } from "@/src/context/CartContext";

export default function ShopCartButton() {
  const pathname = usePathname();
  const { cart, setIsOpen } = useCart();

  // Only display on /shop and its sub-pages (e.g. /shop/product-slug)
  if (!pathname.startsWith("/shop")) {
    return null;
  }

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-5 py-3 rounded-full bg-dark text-light dark:bg-light dark:text-dark shadow-xl hover:scale-105 transition-all duration-200"
      aria-label="View Cart"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.25 10.5a.5.5 0 010-1h7.5a.5.5 0 010 1"
        />
      </svg>
      <span className="text-xs font-bold tracking-wider uppercase">Cart</span>
      {totalCount > 0 && (
        <span className="px-2 py-0.5 text-xs font-extrabold rounded-full bg-light text-dark dark:bg-dark dark:text-light">
          {totalCount}
        </span>
      )}
    </button>
  );
}