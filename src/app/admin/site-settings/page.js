"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/src/components/Admin/RichTextEditor";

export default function SiteSettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    contact_phone: "",
    contact_email: "",
    about_heading: "",
    about_body: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-settings", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load site settings.");
        setForm(result);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save site settings.");
      setForm(result);
      setMessage("Site settings saved.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center"><p className="opacity-60">Loading site settings...</p></main>;

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => router.push("/admin")} className="text-sm opacity-60 hover:opacity-100">Back to Dashboard</button>
        <h1 className="mt-8 text-4xl font-bold">Site settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 opacity-60">Update the public contact details and About page copy from here.</p>

        {error && <div className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">{error}</div>}
        {message && <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-700">{message}</div>}

        <form onSubmit={saveSettings} className="mt-10 space-y-8">
          <section className="rounded-2xl border border-dark/20 p-6">
            <h2 className="text-2xl font-bold">About page</h2>
            <div className="mt-5 space-y-5">
              <label className="block text-sm font-medium">
                Heading
                <input type="text" value={form.about_heading} onChange={(event) => updateField("about_heading", event.target.value)} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
              </label>
              <label className="block text-sm font-medium">
                About text
                <div className="mt-2">
                  <RichTextEditor value={form.about_body} onChange={(value) => updateField("about_body", value)} enableAttachments={false} />
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-dark/20 p-6">
            <h2 className="text-2xl font-bold">Contact details</h2>
            <p className="mt-2 text-sm opacity-60">These appear in the footer and About page. Leave either field blank to hide it.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Contact number
              <input type="tel" value={form.contact_phone} onChange={(event) => updateField("contact_phone", event.target.value)} placeholder="+91 98765 43210" className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
            </label>
            <label className="text-sm font-medium">
              Contact email
              <input type="email" value={form.contact_email} onChange={(event) => updateField("contact_email", event.target.value)} placeholder="hello@example.com" className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
            </label>
          </div>
          </section>
          <button type="submit" disabled={saving} className="rounded-lg bg-dark px-5 py-3 font-medium text-light transition-opacity hover:opacity-80 disabled:opacity-50 dark:bg-light dark:text-dark">
            {saving ? "Saving..." : "Save site settings"}
          </button>
        </form>
      </div>
    </main>
  );
}