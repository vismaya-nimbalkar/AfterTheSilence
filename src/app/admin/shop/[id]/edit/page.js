"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/client";

export default function EditProductPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [images, setImages] = useState([]);
  const [selectedFileName, setSelectedFileName] = useState("no file selected");

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    price: "",
    is_pod: true,
    qikink_sku: "",
    is_in_stock: true,
  });

  useEffect(() => {
    fetch(`/api/admin/shop?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.product) {
          const p = data.product;
          setForm({
            title: p.title || "",
            slug: p.slug || "",
            description: p.description || "",
            price: p.price || "",
            is_pod: p.is_pod !== false,
            qikink_sku: p.qikink_sku || "",
            is_in_stock: p.is_in_stock !== false,
          });
          setImages(p.images || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setUploadingImage(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("shop-products")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("shop-products")
        .getPublicUrl(filePath);

      setImages((prev) => [...prev, data.publicUrl]);
    } catch (err) {
      alert(`Image upload failed: ${err.message}`);
      setSelectedFileName("no file selected");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (urlToRemove) => {
    setImages((prev) => prev.filter((url) => url !== urlToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) {
      alert("Please upload at least one image.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/shop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          title: form.title,
          slug: form.slug,
          description: form.description,
          price: parseFloat(form.price),
          is_pod: form.is_pod,
          qikink_sku: form.qikink_sku,
          images,
          is_in_stock: form.is_in_stock,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push("/admin/shop");
      } else {
        throw new Error(data.error || "Failed to update product.");
      }
    } catch (err) {
      alert(`Error updating product: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-12 sm:px-10">
        <p className="text-sm opacity-60">Loading product details...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin/shop"
          className="text-xs opacity-60 hover:opacity-100 transition-opacity mb-6 inline-block"
        >
          ← Back to Shop Admin
        </Link>

        <h1 className="text-3xl font-bold mb-2">Edit Product</h1>
        <p className="text-sm opacity-60 mb-8">Modify details, stock, pricing, and images.</p>

        <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-8 bg-white dark:bg-zinc-900/50 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium opacity-70 mb-2">Product Title</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium opacity-70 mb-2">URL Slug</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium opacity-70 mb-2">Description</label>
              <textarea
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <label className="block text-xs font-medium opacity-70 mb-2">Selling Price (INR)</label>
                <input
                  type="number"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium opacity-70 mb-2">Stock Availability</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_in_stock: !form.is_in_stock })}
                  className={`w-full py-3 rounded-xl border text-xs font-medium transition-colors ${
                    form.is_in_stock
                      ? "border-green-600/30 text-green-600 bg-green-500/5"
                      : "border-red-500/30 text-red-500 bg-red-500/5"
                  }`}
                >
                  {form.is_in_stock ? "✓ In Stock" : "✕ Out of Stock"}
                </button>
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="block text-xs font-medium opacity-70 mb-2">Order fulfillment</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: true, title: "Print-on-demand (POD)" },
                  { value: false, title: "Normal order" },
                ].map((option) => (
                  <label
                    key={String(option.value)}
                    className={`cursor-pointer rounded-xl border p-4 ${form.is_pod === option.value ? "border-dark dark:border-light" : "border-dark/10 dark:border-light/10"}`}
                  >
                    <input
                      type="radio"
                      name="is_pod"
                      checked={form.is_pod === option.value}
                      onChange={() => setForm((current) => ({ ...current, is_pod: option.value }))}
                      className="mr-2"
                    />
                    <span className="text-sm font-semibold">{option.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.is_pod && (
              <div>
                <div>
                  <label className="block text-xs font-medium opacity-70 mb-2">Qikink My Products SKU *</label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    placeholder="SKU from your Qikink My Products catalog"
                    className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
                    value={form.qikink_sku}
                    onChange={(e) => setForm({ ...form, qikink_sku: e.target.value })}
                  />
                </div>
                <p className="mt-2 text-xs opacity-50">Create the product and artwork in Qikink My Products first, then enter its exact SKU here.</p>
              </div>
            )}

            {/* Image Box */}
            <div>
              <label className="block text-xs font-medium opacity-70 mb-2">Product Images</label>
              <div className="rounded-2xl border border-dashed border-dark/20 dark:border-light/20 p-6 flex flex-col gap-4 bg-transparent">
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 rounded-lg bg-dark/10 dark:bg-light/10 text-xs font-medium hover:opacity-80 transition-opacity">
                    {uploadingImage ? "Uploading..." : "Choose File"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs opacity-60">{selectedFileName}</span>
                </div>

                {images.length > 0 && (
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-dark/10 dark:border-light/10">
                    {images.map((url, idx) => (
                      <div key={idx} className="relative w-20 h-20 group">
                        <img
                          src={url}
                          alt="Product preview"
                          className="w-full h-full object-cover rounded-xl border border-dark/10"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-dark/10 dark:border-light/10">
              <button
                type="submit"
                disabled={submitting || uploadingImage}
                className="w-full py-3 bg-dark text-light dark:bg-light dark:text-dark rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Saving Changes..." : "Update Product"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}