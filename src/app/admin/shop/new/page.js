"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import BackLink from "@/src/components/BackLink";
import { useConfirmDialog } from "@/src/components/Admin/ConfirmDialog";

export default function NewProductPage() {
  const { alert, dialog } = useConfirmDialog();
  const router = useRouter();
  const supabase = createClient();

  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [images, setImages] = useState([]);
  const [selectedFileName, setSelectedFileName] = useState("no file selected");

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    price: "",
    shipping_weight_kg: "",
    shipping_length_cm: "",
    shipping_width_cm: "",
    shipping_height_cm: "",
  });

  // Automatically generate URL slug from product title
  const handleTitleChange = (e) => {
    const title = e.target.value;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    setForm((prev) => ({ ...prev, title, slug }));
  };

  // Upload File directly to Supabase Storage Bucket
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
      await alert(`Image upload failed: ${err.message}`, "Image upload failed");
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
      await alert("Upload at least one product image before publishing.", "Product image required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          description: form.description,
          price: parseFloat(form.price),
          shipping_weight_kg: form.shipping_weight_kg,
          shipping_length_cm: form.shipping_length_cm,
          shipping_width_cm: form.shipping_width_cm,
          shipping_height_cm: form.shipping_height_cm,
          images,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push("/admin/shop");
      } else {
        throw new Error(data.error || "Failed to save product.");
      }
    } catch (err) {
      await alert(`Error saving product: ${err.message}`, "Could not save product");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <BackLink href="/admin">Back to Dashboard</BackLink>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-2">Create New Product</h1>
        <p className="text-sm opacity-60 mb-8">
          Add a product with its packed dimensions for live shipping quotes.
        </p>

        {/* Form Container */}
        <div className="rounded-2xl border border-dark/10 dark:border-light/10 p-8 bg-white dark:bg-zinc-900/50 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium opacity-70 mb-2">
                  Product Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Graphic Tee"
                  className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
                  value={form.title}
                  onChange={handleTitleChange}
                />
              </div>

              <div>
                <label className="block text-xs font-medium opacity-70 mb-2">
                  URL Slug
                </label>
                <input
                  type="text"
                  required
                  placeholder="graphic-tee"
                  className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium opacity-70 mb-2">
                Description
              </label>
              <textarea
                rows={4}
                placeholder="Write a clear summary of this item..."
                className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium opacity-70 mb-2">
                  Selling Price (INR)
                </label>
                <input
                  type="number"
                  required
                  placeholder="999"
                  className="w-full px-4 py-3 rounded-xl border border-dark/10 dark:border-light/10 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-dark dark:focus:ring-light"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value })
                  }
                />
              </div>

            </div>

            <fieldset className="space-y-3">
              <legend className="block text-xs font-medium opacity-70">Packed product dimensions for Shiprocket</legend>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  ["shipping_weight_kg", "Weight (kg)", "0.5"],
                  ["shipping_length_cm", "Length (cm)", "20"],
                  ["shipping_width_cm", "Width (cm)", "15"],
                  ["shipping_height_cm", "Height (cm)", "5"],
                ].map(([key, label, placeholder]) => (
                  <label key={key} className="text-xs opacity-70">
                    {label}
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                      className="mt-2 w-full rounded-xl border border-dark/10 bg-transparent px-3 py-3 text-sm dark:border-light/10"
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs opacity-50">Measure one packed unit. The checkout quote and shipment use these dimensions.</p>
            </fieldset>

            {/* Custom Image Upload Box */}
            <div>
              <label className="block text-xs font-medium opacity-70 mb-2">
                Product Image
              </label>

              <div className="rounded-2xl border border-dashed border-dark/20 dark:border-light/20 p-6 flex flex-col gap-4 bg-transparent">
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 rounded-lg bg-dark/10 dark:bg-light/10 text-xs font-medium hover:opacity-80 transition-opacity">
                    {uploadingImage ? "Uploading..." : "Choose File"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs opacity-60">
                    {selectedFileName}
                  </span>
                </div>

                <p className="text-xs opacity-40">
                  JPG, PNG or WebP. Maximum 10 MB.
                </p>

                {/* Uploaded Images Preview Strip */}
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-dark/10 dark:border-light/10">
                    {images.map((url, idx) => (
                      <div key={idx} className="relative w-20 h-20 group">
                        <img
                          src={url}
                          alt="Uploaded product preview"
                          className="w-full h-full object-cover rounded-xl border border-dark/10"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-dark/10 dark:border-light/10">
              <button
                type="submit"
                disabled={submitting || uploadingImage}
                className="w-full py-3 bg-dark text-light dark:bg-light dark:text-dark rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Publishing Product..." : "Save & Publish"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {dialog}
    </main>
  );
}