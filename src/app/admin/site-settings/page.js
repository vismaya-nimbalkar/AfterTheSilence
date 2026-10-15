"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/src/components/Admin/RichTextEditor";
import BackLink from "@/src/components/BackLink";

export default function SiteSettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    contact_phone: "",
    contact_email: "",
    about_heading: "",
    about_body: "",
    // Social Links
    github_url: "",
    linkedin_url: "",
    instagram_url: "",
    reddit_url: "",
    discord_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-settings", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load site settings.");
        // Merge with defaults so undefined fields fallback to empty strings
        setForm((prev) => ({ ...prev, ...result }));
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const settings = { ...form };
      delete settings.shop_enabled;
      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save site settings.");
      router.push("/admin");
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
        <BackLink href="/admin">Back to Dashboard</BackLink>
        <h1 className="mt-8 text-4xl font-bold">Site settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 opacity-60">Update public contact details, social links, and About page copy from here.</p>

        {error && <div className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">{error}</div>}

        <form onSubmit={saveSettings} className="mt-10 space-y-8">
          <section className="rounded-2xl border border-dark/20 p-6">
            <h2 className="text-2xl font-bold">About page</h2>
            <div className="mt-5 space-y-5">
              <label className="block text-sm font-medium">
                Heading
                <input type="text" value={form.about_heading || ""} onChange={(event) => updateField("about_heading", event.target.value)} className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
              </label>
              <label className="block text-sm font-medium">
                About text
                <div className="mt-2">
                  <RichTextEditor value={form.about_body || ""} onChange={(value) => updateField("about_body", value)} enableAttachments={false} enableFootnotes={false} />
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-dark/20 p-6">
            <h2 className="text-2xl font-bold">Contact details</h2>
            <p className="mt-2 text-sm opacity-60">These appear in the footer and About page. Leave either field blank to hide it.</p>
            <div className="grid gap-5 sm:grid-cols-2 mt-5">
              <label className="text-sm font-medium">
                Contact number
                <input type="tel" value={form.contact_phone || ""} onChange={(event) => updateField("contact_phone", event.target.value)} placeholder="+91 98765 43210" className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Contact email
                <input type="email" value={form.contact_email || ""} onChange={(event) => updateField("contact_email", event.target.value)} placeholder="hello@example.com" className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
              </label>
            </div>
          </section>

          {/* Social Links Section */}
          <section className="rounded-2xl border border-dark/20 p-6">
            <h2 className="text-2xl font-bold">Social Links</h2>
            <p className="mt-2 text-sm opacity-60">Add links to display in your website footer. Leave any blank to hide that icon/link.</p>
            <div className="grid gap-5 sm:grid-cols-2 mt-5">
              <label className="text-sm font-medium">
                GitHub URL
                <input type="url" value={form.github_url || ""} onChange={(e) => updateField("github_url", e.target.value)} placeholder="https://github.com/username" className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                LinkedIn URL
                <input type="url" value={form.linkedin_url || ""} onChange={(e) => updateField("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/username" className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Instagram URL
                <input type="url" value={form.instagram_url || ""} onChange={(e) => updateField("instagram_url", e.target.value)} placeholder="https://instagram.com/username" className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
              </label>
              <label className="text-sm font-medium">
                Reddit URL
                <input type="url" value={form.reddit_url || ""} onChange={(e) => updateField("reddit_url", e.target.value)} placeholder="https://reddit.com/user/username" className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Discord Invite / Profile URL
                <input type="url" value={form.discord_url || ""} onChange={(e) => updateField("discord_url", e.target.value)} placeholder="https://discord.gg/yourserver" className="mt-2 w-full rounded-lg border border-dark/20 bg-transparent px-4 py-3" />
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