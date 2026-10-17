"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ProductImageGallery from "@/src/components/shop/ProductImageGallery";
import BackLink from "@/src/components/BackLink";
import { useConfirmDialog } from "@/src/components/Admin/ConfirmDialog";

// Safari-Safe Canvas Cropper Modal
function ImageCropModal({ imageSrc, onCancel, onSave, onError }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      drawCanvas();
    };
  }, [imageSrc]);

  useEffect(() => {
    drawCanvas();
  }, [zoom, offset]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    const size = 500;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Canvas background
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(0, 0, size, size);

    const baseScale = Math.min(size / img.width, size / img.height);
    const scaledWidth = img.width * baseScale * zoom;
    const scaledHeight = img.height * baseScale * zoom;

    const x = (size - scaledWidth) / 2 + offset.x;
    const y = (size - scaledHeight) / 2 + offset.y;

    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

    try {
      const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      onSave(croppedDataUrl);
    } catch (err) {
      onError("Error saving canvas image. Please try another image file.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-dark/10 dark:border-light/10 space-y-6 shadow-2xl">
        <h3 className="text-lg font-bold">Crop & Frame Product Image</h3>

        {/* Canvas Area */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-dark/10 cursor-grab active:cursor-grabbing bg-zinc-100 dark:bg-zinc-800">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Controls */}
        <div className="space-y-3 text-xs">
          <div className="flex justify-between font-semibold opacity-70">
            <span>Zoom Level</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="2.5"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-dark dark:accent-light cursor-pointer"
          />
          <p className="text-[10px] opacity-50 text-center">
            💡 Drag inside the frame to adjust the position of your shirt/design.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-dark/20 text-xs font-semibold hover:bg-dark/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-5 py-2.5 rounded-xl bg-dark text-light dark:bg-light dark:text-dark text-xs font-bold hover:opacity-80 transition-opacity"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminShopPage() {
  const { confirm, alert, dialog } = useConfirmDialog();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [promoLoading, setPromoLoading] = useState(true);
  const [promoError, setPromoError] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [shopEnabled, setShopEnabled] = useState(null);
  const [siteSettings, setSiteSettings] = useState(null);
  const [shopVisibilitySaving, setShopVisibilitySaving] = useState(false);
  const [shopVisibilityError, setShopVisibilityError] = useState("");
  const [promoForm, setPromoForm] = useState({
    code: "",
    discount_type: "percent",
    discount_value: "",
    max_discount_amount: "",
    minimum_order_amount: "0",
    max_uses: "",
    starts_at: "",
    expires_at: "",
  });

  // Form State
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    price: "",
    is_in_stock: true,
    shipping_weight_kg: "",
    shipping_length_cm: "",
    shipping_width_cm: "",
    shipping_height_cm: "",
    images: Array(6).fill(null),
  });

  // Cropper State
  const [cropState, setCropState] = useState({
    slotIndex: null,
    src: null,
  });

  const fileInputRef = useRef(null);
  const [activeSlotForUpload, setActiveSlotForUpload] = useState(null);

  const fetchProducts = () => {
    setLoading(true);
    setLoadError("");
    fetch("/api/admin/products", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load products.");
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
  };

  useEffect(() => {
    fetchProducts();
    fetch("/api/admin/site-settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load shop visibility.");
        setSiteSettings(data);
        setShopEnabled(data.shop_enabled !== false);
      })
      .catch((error) => setShopVisibilityError(error.message));
    fetch("/api/admin/shop/promotions", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load promo codes.");
        setPromotions(data.promotions || []);
      })
      .catch((error) => setPromoError(error.message))
      .finally(() => setPromoLoading(false));
  }, []);

  const toggleShopVisibility = async () => {
    if (shopEnabled === null || !siteSettings) return;
    setShopVisibilitySaving(true);
    setShopVisibilityError("");
    try {
      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_enabled: !shopEnabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update shop visibility.");
      setSiteSettings(data);
      setShopEnabled(data.shop_enabled !== false);
    } catch (error) {
      setShopVisibilityError(error.message);
    } finally {
      setShopVisibilitySaving(false);
    }
  };

  const refreshPromotions = async () => {
    const response = await fetch("/api/admin/shop/promotions", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load promo codes.");
    setPromotions(data.promotions || []);
  };

  const handleCreatePromo = async (event) => {
    event.preventDefault();
    setPromoError("");
    setPromoMessage("");
    try {
      const response = await fetch("/api/admin/shop/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promoForm),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not create promo code.");
      setPromotions((current) => [data.promotion, ...current]);
      setPromoForm({
        code: "",
        discount_type: "percent",
        discount_value: "",
        max_discount_amount: "",
        minimum_order_amount: "0",
        max_uses: "",
        starts_at: "",
        expires_at: "",
      });
      setPromoMessage("Promo code created.");
    } catch (error) {
      setPromoError(error.message);
    }
  };

  const handleTogglePromo = async (promotion) => {
    try {
      const response = await fetch("/api/admin/shop/promotions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promotion.id, is_active: !promotion.is_active }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not update promo code.");
      setPromotions((current) => current.map((entry) => entry.id === promotion.id ? data.promotion : entry));
    } catch (error) {
      setPromoError(error.message);
    }
  };

  const handleDeletePromo = async (promotion) => {
    if (!await confirm({
      title: "Delete promo code?",
      message: `Delete "${promotion.code}"? Existing redemption history will be kept.`,
      confirmLabel: "Delete promo code",
    })) return;
    setPromoError("");
    setPromoMessage("");
    try {
      const response = await fetch("/api/admin/shop/promotions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promotion.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not delete promo code.");
      setPromotions((current) => current.filter((entry) => entry.id !== promotion.id));
      setPromoMessage(`Promo code ${promotion.code} deleted.`);
    } catch (error) {
      setPromoError(error.message);
    }
  };

  const handleTileClick = (index) => {
    setActiveSlotForUpload(index);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || activeSlotForUpload === null) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropState({
        slotIndex: activeSlotForUpload,
        src: reader.result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCroppedImage = (croppedUrl) => {
    if (cropState.slotIndex === null) return;

    const newImages = [...form.images];
    newImages[cropState.slotIndex] = croppedUrl;

    setForm({ ...form, images: newImages });
    setCropState({ slotIndex: null, src: null });
    setActiveSlotForUpload(null);
  };

  const handleRemoveImage = (index, e) => {
    e.stopPropagation();
    const newImages = [...form.images];
    newImages[index] = null;
    setForm({ ...form, images: newImages });
  };

  const handleEditClick = (product) => {
    setEditingId(product.id);

    // Fill 6 slot array with product images
    const slots = Array(6).fill(null);
    if (Array.isArray(product.images)) {
      product.images.forEach((img, idx) => {
        if (idx < 6) slots[idx] = img;
      });
    }

    setForm({
      title: product.title || "",
      slug: product.slug || "",
      description: product.description || "",
      price: product.price ? String(product.price) : "",
      is_in_stock: product.is_in_stock !== false,
      shipping_weight_kg: product.shipping_weight_kg ? String(product.shipping_weight_kg) : "",
      shipping_length_cm: product.shipping_length_cm ? String(product.shipping_length_cm) : "",
      shipping_width_cm: product.shipping_width_cm ? String(product.shipping_width_cm) : "",
      shipping_height_cm: product.shipping_height_cm ? String(product.shipping_height_cm) : "",
      images: slots,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({
      title: "",
      slug: "",
      description: "",
      price: "",
      is_in_stock: true,
      shipping_weight_kg: "",
      shipping_length_cm: "",
      shipping_width_cm: "",
      shipping_height_cm: "",
      images: Array(6).fill(null),
    });
  };

  const handleDeleteProduct = async (id, title) => {
    if (!await confirm({
      title: "Delete product?",
      message: `Are you sure you want to permanently delete "${title}"?`,
      confirmLabel: "Delete product",
    })) return;

    try {
      const res = await fetch(`/api/admin/products?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Delete failed");

      if (editingId === id) handleCancelEdit();
      fetchProducts();
    } catch (err) {
      await alert(`Delete error: ${err.message}`, "Could not delete product");
    }
  };

  const handleToggleStock = async (product) => {
    const nextStock = product.is_in_stock === false;
    try {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, is_in_stock: nextStock }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not update stock availability.");
      setProducts((current) => current.map((entry) => entry.id === product.id
        ? { ...entry, is_in_stock: nextStock }
        : entry));
    } catch (error) {
      await alert(`Inventory update failed: ${error.message}`, "Could not update inventory");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price) {
      await alert("Enter a product title and price before saving.", "Product details required");
      return;
    }

    const validImages = form.images.filter((img) => img !== null);

    try {
      const res = await fetch("/api/admin/products", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...form,
          images: validImages,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save product");

      handleCancelEdit();
      fetchProducts();
    } catch (err) {
      await alert(`Error saving product: ${err.message}`, "Could not save product");
    }
  };

  return (
    <main className="min-h-screen max-w-6xl mx-auto px-6 py-16 space-y-12">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="mb-6">
        <BackLink href="/admin">Back to Dashboard</BackLink>
      </div>
      <section className="mb-8 flex flex-col gap-4 rounded-2xl border border-dark/10 p-5 dark:border-light/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Public shop visibility</h2>
          <p className="mt-1 text-sm opacity-60">
            {shopEnabled === null ? "Loading shop status..." : shopEnabled ? "The shop is visible to visitors." : "The shop is hidden from visitors."}
          </p>
          {shopVisibilityError && <p role="alert" className="mt-2 text-sm text-red-600">{shopVisibilityError}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {shopEnabled === false && (
            <Link
              href="/shop?preview=1"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-dark/20 px-4 py-2.5 text-sm font-medium hover:bg-dark/5 dark:border-light/20 dark:hover:bg-light/5"
            >
              Preview shop
            </Link>
          )}
          <button
            type="button"
            onClick={toggleShopVisibility}
            disabled={shopEnabled === null || shopVisibilitySaving}
            className="rounded-lg bg-dark px-4 py-2.5 text-sm font-medium text-light transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-light dark:text-dark"
          >
            {shopVisibilitySaving ? "Saving..." : shopEnabled ? "Turn shop off" : "Turn shop on"}
          </button>
        </div>
      </section>
      <h1 className="text-3xl font-bold">Shop Inventory Management</h1>
      <p className="text-sm opacity-60 mt-1 mb-8">
        Add, edit, and manage store products.
      </p>

      <section className="rounded-2xl border border-dark/10 bg-white p-6 shadow-sm dark:border-light/10 dark:bg-zinc-900/50 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{editingId ? "Edit Product" : "Add New Product"}</h2>
          {editingId && (
            <button type="button" onClick={handleCancelEdit} className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline">
              Cancel Editing
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-7">
          <div className="grid grid-cols-1 items-end gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold opacity-70">Product title *</label>
              <input
                type="text"
                required
                placeholder="Over-sized Graphic Tee"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-dark/10 bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dark/10 dark:border-light/10 dark:focus:ring-light/10"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold opacity-70">Price (₹) *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="999"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full rounded-xl border border-dark/10 bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dark/10 dark:border-light/10 dark:focus:ring-light/10"
              />
            </div>
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-dark/10 px-4 py-3 text-sm dark:border-light/10 md:col-span-2">
              <input
                type="checkbox"
                checked={form.is_in_stock !== false}
                onChange={(event) => setForm({ ...form, is_in_stock: event.target.checked })}
              />
              <span>In stock and available to buy</span>
            </label>
          </div>

          <fieldset className="space-y-3">
            <legend className="block text-xs font-semibold opacity-70">Packed product dimensions for Shiprocket</legend>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ["shipping_weight_kg", "Weight (kg)"],
                ["shipping_length_cm", "Length (cm)"],
                ["shipping_width_cm", "Width (cm)"],
                ["shipping_height_cm", "Height (cm)"],
              ].map(([key, label]) => (
                <label key={key} className="text-xs opacity-70">
                  {label}
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={form[key]}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-dark/10 bg-transparent px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dark/10 dark:border-light/10 dark:focus:ring-light/10"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs opacity-50">Measure one packed unit; checkout uses the total quantity to estimate parcel size.</p>
          </fieldset>

          <div>
            <label className="mb-2 block text-xs font-semibold opacity-70">Description</label>
            <textarea
              rows={3}
              placeholder="100% Cotton, Heavyweight fabric..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-dark/10 bg-transparent px-4 py-3 text-sm focus:outline-none dark:border-light/10"
            />
          </div>

          {/* COMPACT TILE GRID (w-24 h-24 / w-28 h-28) */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold opacity-70">
                Product Images (Click any slot to add)
              </label>
              <span className="text-xs opacity-50">
                {form.images.filter(Boolean).length} / 6 selected
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {form.images.map((imgUrl, index) => (
                <div
                  key={index}
                  onClick={() => !imgUrl && handleTileClick(index)}
                  className={`relative aspect-square w-full rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group overflow-hidden ${
                    imgUrl
                      ? "border-solid border-dark/20 dark:border-light/20 bg-zinc-100 dark:bg-zinc-800"
                      : "border-dark/15 dark:border-light/15 hover:border-dark/40 dark:hover:border-light/40 bg-dark/5 dark:bg-light/5"
                  }`}
                >
                  {imgUrl ? (
                    <>
                      <img
                        src={imgUrl}
                        alt={`Slot ${index + 1}`}
                        className="w-full h-full object-contain p-1"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleRemoveImage(index, e)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 text-dark/40 dark:text-light/40 group-hover:text-dark dark:group-hover:text-light transition-colors">
                      <span className="text-xl font-light leading-none">+</span>
                      <span className="text-[10px] font-medium">Slot {index + 1}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-dark py-3.5 text-sm font-bold text-light transition-opacity hover:opacity-80 dark:bg-light dark:text-dark"
          >
            {editingId ? "Update Product" : "Save Product to Shop"}
          </button>
        </form>
      </section>

      {/* EXISTING PRODUCTS MANAGEMENT SECTION */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Existing Store Products ({products.length})</h2>

        {loadError && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
            {loadError}
          </p>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs opacity-60">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-8 text-center text-xs opacity-60">
            No products created yet. Use the form above to add your first item.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              return (
                <div
                  key={product.id}
                  className="rounded-2xl border border-dark/10 dark:border-light/10 p-4 bg-white dark:bg-zinc-900/50 flex flex-col justify-between space-y-4 shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="relative">
                      <ProductImageGallery
                        images={product.images || []}
                        title={product.title}
                        compact
                      />
                      <span className={`absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold ${product.is_in_stock === false ? "bg-red-500/90 text-white" : "bg-green-600/90 text-white"}`}>
                        {product.is_in_stock === false ? "Out of stock" : "In stock"}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-sm leading-snug">{product.title}</h3>
                        <span className="font-bold text-xs">₹{product.price}</span>
                      </div>
                      {product.description && (
                        <p className="text-xs opacity-60 line-clamp-2 mt-1">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-1 gap-2 border-t border-dark/10 pt-3 dark:border-light/10 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => handleEditClick(product)}
                      className="py-2 px-3 rounded-xl border border-dark/20 text-xs font-semibold hover:bg-dark/5 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStock(product)}
                      className="py-2 px-3 rounded-xl border border-dark/20 text-xs font-semibold hover:bg-dark/5 transition-colors"
                    >
                      Mark {product.is_in_stock === false ? "In Stock" : "Out of Stock"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product.id, product.title)}
                      className="py-2 px-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <section className="space-y-6 rounded-2xl border border-dark/10 bg-white p-6 shadow-sm dark:border-light/10 dark:bg-zinc-900/50 sm:p-8">
        <div>
          <h2 className="text-2xl font-bold">Promo codes</h2>
          <p className="mt-1 text-sm opacity-60">Create percentage or fixed discounts. Codes are validated on the server and reserved during checkout.</p>
        </div>
        {promoError && <p role="alert" className="rounded-lg border border-red-500/30 p-3 text-sm text-red-700 dark:text-red-300">{promoError}</p>}
        {promoMessage && <p role="status" className="rounded-lg border border-green-500/30 p-3 text-sm text-green-700 dark:text-green-300">{promoMessage}</p>}
        <form onSubmit={handleCreatePromo} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold">Code
            <input required maxLength={32} value={promoForm.code} onChange={(event) => setPromoForm({ ...promoForm, code: event.target.value.toUpperCase() })} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2.5" placeholder="WELCOME10" />
          </label>
          <label className="text-xs font-semibold">Discount type
            <select value={promoForm.discount_type} onChange={(event) => setPromoForm({ ...promoForm, discount_type: event.target.value })} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2.5">
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed amount (₹)</option>
            </select>
          </label>
          <label className="text-xs font-semibold">Discount {promoForm.discount_type === "percent" ? "(%)" : "(₹)"}
            <input type="number" min="0.01" step="0.01" max={promoForm.discount_type === "percent" ? 100 : undefined} required value={promoForm.discount_value} onChange={(event) => setPromoForm({ ...promoForm, discount_value: event.target.value })} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2.5" />
          </label>
          {promoForm.discount_type === "percent" && (
            <label className="text-xs font-semibold">Maximum discount (₹, optional)
              <input type="number" min="0.01" step="0.01" value={promoForm.max_discount_amount} onChange={(event) => setPromoForm({ ...promoForm, max_discount_amount: event.target.value })} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2.5" />
            </label>
          )}
          <label className="text-xs font-semibold">Minimum order (₹)
            <input type="number" min="0" step="0.01" value={promoForm.minimum_order_amount} onChange={(event) => setPromoForm({ ...promoForm, minimum_order_amount: event.target.value })} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2.5" />
          </label>
          <label className="text-xs font-semibold">Maximum uses (optional)
            <input type="number" min="1" step="1" value={promoForm.max_uses} onChange={(event) => setPromoForm({ ...promoForm, max_uses: event.target.value })} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2.5" />
          </label>
          <label className="text-xs font-semibold">Starts at (optional)
            <input type="datetime-local" value={promoForm.starts_at} onChange={(event) => setPromoForm({ ...promoForm, starts_at: event.target.value })} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2.5" />
          </label>
          <label className="text-xs font-semibold">Expires at (optional)
            <input type="datetime-local" value={promoForm.expires_at} onChange={(event) => setPromoForm({ ...promoForm, expires_at: event.target.value })} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-3 py-2.5" />
          </label>
          <button type="submit" className="rounded-lg bg-dark px-4 py-2.5 text-sm font-semibold text-light dark:bg-light dark:text-dark">Create promo code</button>
        </form>
        {promoLoading ? (
          <p className="text-sm opacity-60">Loading promo codes...</p>
        ) : promotions.length ? (
          <div className="space-y-3">
            {promotions.map((promotion) => (
              <div key={promotion.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dark/10 p-4 dark:border-light/10">
                <div>
                  <p className="font-bold">{promotion.code} <span className="text-xs font-normal opacity-60">— {promotion.discount_type === "percent" ? `${promotion.discount_value}% off` : `₹${promotion.discount_value} off`}</span></p>
                  <p className="mt-1 text-xs opacity-60">
                    {promotion.max_uses ? `Up to ${promotion.max_uses} uses` : "Unlimited uses"}
                    {Number(promotion.minimum_order_amount) > 0 ? ` · Minimum ₹${promotion.minimum_order_amount}` : ""}
                    {promotion.expires_at ? ` · Expires ${new Date(promotion.expires_at).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleTogglePromo(promotion)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${promotion.is_active ? "border-green-600/30 text-green-700" : "border-dark/20 opacity-60"}`}>
                    {promotion.is_active ? "Disable" : "Enable"}
                  </button>
                  <button type="button" onClick={() => handleDeletePromo(promotion)} className="rounded-lg border border-red-600/30 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-500/10 dark:text-red-300">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm opacity-60">No promo codes created yet.</p>
        )}
      </section>

      {/* Cropper Modal */}
      {cropState.src && (
        <ImageCropModal
          imageSrc={cropState.src}
          onCancel={() => setCropState({ slotIndex: null, src: null })}
          onSave={handleSaveCroppedImage}
          onError={(message) => alert(message, "Could not save image")}
        />
      )}
      {dialog}
    </main>
  );
}