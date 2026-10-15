"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/src/context/CartContext";
import ProductImageGallery from "@/src/components/shop/ProductImageGallery";
import BackLink from "@/src/components/BackLink";

export default function ProductClient({ slug, preview }) {
  const router = useRouter();
  const { addToCart, setPreviewMode } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setPreviewMode(preview);
    fetch(`/api/shop/products${preview ? "?preview=1" : ""}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load product.");
        return data;
      })
      .then((data) => {
        const found = (data.products || []).find((p) => p.slug === slug);
        setProduct(found || null);
        setLoading(false);
      })
      .catch((error) => {
        setLoadError(error.message);
        setLoading(false);
      });
  }, [slug, preview, setPreviewMode]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
    }
  };

  const handleBuyNow = () => {
    if (product) {
      addToCart(product, quantity);
      router.push(`/checkout${preview ? "?preview=1" : ""}`);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[60vh] max-w-5xl mx-auto px-6 py-16 sm:px-10">
        <p className="text-sm opacity-60">Loading product details...</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-[60vh] max-w-5xl mx-auto px-6 py-16 sm:px-10 text-center">
        <h1 className="text-2xl font-bold mb-4">{loadError ? "Could Not Load Product" : "Product Not Found"}</h1>
        {loadError && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{loadError}</p>}
        <BackLink href={`/shop${preview ? "?preview=1" : ""}`}>Back to Shop</BackLink>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-16 sm:px-10">
      <div className="mb-8">
        <BackLink href={`/shop${preview ? "?preview=1" : ""}`}>Back to Shop</BackLink>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14 items-start">
        {/* Product Image */}
        <ProductImageGallery images={product.images || []} title={product.title} />

        {/* Product Details & Actions */}
        <div className="flex flex-col justify-between space-y-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{product.title}</h1>
            <p className="text-2xl font-semibold mt-3">₹{product.price}</p>
            <p className="text-sm opacity-70 mt-4 leading-relaxed whitespace-pre-line">
              {product.description || "No description provided."}
            </p>
          </div>

          <div className="space-y-6 pt-6 border-t border-dark/10 dark:border-light/10">
            {preview && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                Admin preview checkout uses the site’s live payment and fulfillment flow. Any purchase will charge you and be processed as a real order.
              </p>
            )}
            {/* Quantity Selector */}
            {product.is_in_stock !== false && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold opacity-70">Quantity</span>
                <div className="flex items-center border border-dark/20 dark:border-light/20 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3 py-1.5 text-sm hover:bg-dark/5 dark:hover:bg-light/5 transition-colors"
                  >
                    -
                  </button>
                  <span className="px-4 py-1.5 text-xs font-bold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="px-3 py-1.5 text-sm hover:bg-dark/5 dark:hover:bg-light/5 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {product.is_in_stock === false ? (
              <button
                disabled
                className="w-full py-3.5 rounded-xl border border-dark/20 text-sm font-semibold opacity-40 cursor-not-allowed text-center"
              >
                Out of Stock
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="py-3.5 px-5 rounded-xl border border-dark dark:border-light text-xs font-semibold hover:bg-dark/5 dark:hover:bg-light/5 transition-colors"
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="py-3.5 px-5 rounded-xl bg-dark text-light dark:bg-light dark:text-dark text-xs font-semibold hover:opacity-80 transition-opacity"
                >
                  Buy Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}