"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/src/context/CartContext";
import { useRouter } from "next/navigation";
import ProductImageGallery from "@/src/components/shop/ProductImageGallery";
import CartQuantityControl from "@/src/components/shop/CartQuantityControl";

export default function ShopClient({ preview }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [shopDisabled, setShopDisabled] = useState(false);
  const { addToCart, setIsOpen, setPreviewMode } = useCart();
  const router = useRouter();

  useEffect(() => {
    setPreviewMode(preview);
    fetch(`/api/shop/products${preview ? "?preview=1" : ""}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setShopDisabled(Boolean(data.shopDisabled));
          throw new Error(data.error || "Could not load products.");
        }
        return data;
      })
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch((error) => {
        setLoadError(error.message);
        setLoading(false);
      });
  }, [preview, setPreviewMode]);

  const handleBuyNow = (product) => {
    setIsOpen(false);
    addToCart(product, 1);
    router.push(`/checkout${preview ? "?preview=1" : ""}`);
  };

  return (
    <main className="min-h-screen max-w-6xl mx-auto px-6 py-16 sm:px-10">
      {/* Spaced Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12 pb-6 border-b border-dark/10 dark:border-light/10">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Shop</h1>
          <p className="text-sm sm:text-base opacity-60 mt-2">
            Official merchandise and apparel from After The Silence.
          </p>
        </div>

        {/* Spaced Action Buttons */}
        <div className="flex items-center gap-3 self-end">
          <Link
            href="/shop/track"
            className="px-5 py-2.5 rounded-full border border-dark/20 dark:border-light/20 text-xs font-semibold hover:bg-dark/5 dark:hover:bg-light/5 transition-colors whitespace-nowrap"
          >
            Track Order
          </Link>
        </div>
      </div>

      {preview && (
        <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          Admin preview checkout uses the site’s live payment and fulfillment flow. Any purchase will charge you and be processed as a real order.
        </div>
      )}

      {/* Product Grid */}
      {loading ? (
        <div className="py-24 text-center text-sm opacity-60">Loading products...</div>
      ) : loadError ? (
        <div role={shopDisabled ? "status" : "alert"} className={`py-24 text-center text-sm ${shopDisabled ? "opacity-60" : "text-red-700 dark:text-red-300"}`}>
          {shopDisabled ? "The shop is temporarily closed. Please check back later." : loadError}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-16 text-center text-sm opacity-60 bg-white/50 dark:bg-zinc-900/50">
          No products available right now. Check back soon!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((item) => (
            <div
              key={item.id}
              className="group rounded-2xl border border-dark/10 dark:border-light/10 p-6 flex flex-col justify-between bg-white dark:bg-zinc-900/50 transition-all duration-300 hover:border-dark/30 dark:hover:border-light/30 shadow-sm hover:shadow-md"
            >
              <div>
                {/* Image Container */}
                <div className="mb-5">
                  <ProductImageGallery
                    images={item.images || []}
                    title={item.title}
                    linkHref={`/shop/${item.slug}${preview ? "?preview=1" : ""}`}
                    compact
                  />
                </div>

                {/* Title & Price */}
                <div className="flex justify-between items-baseline gap-2 mb-2">
                  <Link href={`/shop/${item.slug}${preview ? "?preview=1" : ""}`} className="hover:underline">
                    <h2 className="text-xl font-bold tracking-tight">{item.title}</h2>
                  </Link>
                  <span className="text-lg font-semibold whitespace-nowrap">
                    ₹{item.price}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm opacity-60 line-clamp-2 leading-relaxed">
                  {item.description || "No description provided."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-4 border-t border-dark/10 dark:border-light/10">
                {item.is_in_stock === false ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl border border-dark/20 dark:border-light/20 text-xs font-semibold opacity-40 cursor-not-allowed text-center"
                  >
                    Out of Stock
                  </button>
                ) : (
                  <div className="grid grid-cols-2 items-start gap-3">
                    <CartQuantityControl product={item} />
                    <button
                      type="button"
                      onClick={() => handleBuyNow(item)}
                      className="min-h-11 rounded-xl bg-dark px-2 text-xs font-semibold text-light transition-opacity hover:opacity-80 dark:bg-light dark:text-dark"
                    >
                      Buy Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}