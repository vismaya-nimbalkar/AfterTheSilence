"use client";

import { useState } from "react";
import { useCart } from "@/src/context/CartContext";

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images.slice(0, 6)
    : ["/placeholder.jpg"];

  return (
    <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-4 bg-white dark:bg-zinc-900/50 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
      {/* Main Image Container */}
      <div className="relative aspect-square w-full rounded-xl bg-zinc-100 dark:bg-zinc-800/60 overflow-hidden flex items-center justify-center">
        <img
          src={images[activeImgIndex]}
          alt={product.title}
          className="w-full h-full object-contain p-2 transition-all duration-300"
        />

        {/* Thumbnail Selector Overlay if > 1 Image */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImgIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === activeImgIndex
                    ? "bg-dark dark:bg-light scale-125"
                    : "bg-dark/30 dark:bg-light/30 hover:bg-dark/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-base leading-snug">{product.title}</h3>
          <span className="font-bold text-sm">₹{product.price}</span>
        </div>
        {product.description && (
          <p className="text-xs opacity-60 line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dark/10 dark:border-light/10">
        <button
          type="button"
          onClick={() => addToCart(product, 1)}
          className="py-2.5 px-3 rounded-xl border border-dark/20 dark:border-light/20 text-xs font-semibold hover:bg-dark/5 dark:hover:bg-light/5 transition-colors"
        >
          Add to Cart
        </button>
        <button
          type="button"
          onClick={() => {
            addToCart(product, 1);
            window.location.href = "/checkout";
          }}
          className="py-2.5 px-3 rounded-xl bg-dark text-light dark:bg-light dark:text-dark text-xs font-semibold hover:opacity-80 transition-opacity"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}