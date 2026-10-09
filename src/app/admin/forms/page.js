"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/src/components/Admin/ConfirmDialog";

export default function FormsAdminPage() {
  const router = useRouter();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharedFormId, setSharedFormId] = useState(null);
  const { confirm, dialog } = useConfirmDialog();

  const load = () => fetch("/api/admin/forms", { cache: "no-store" })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load forms.");
      setForms(result.forms || []);
    })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const remove = async (form) => {
    if (!await confirm({
      title: "Delete form?",
      message: `The form "${form.title}" will be permanently deleted.`,
      confirmLabel: "Delete form",
    })) return;
    const response = await fetch(`/api/admin/forms/${form.id}`, { method: "DELETE" });
    if (response.ok) setForms((current) => current.filter((item) => item.id !== form.id));
    else setError("Could not delete form.");
  };

  const share = async (form) => {
    setError("");
    setSharedFormId(null);
    if (form.status !== "published") {
      setError("Publish this form before sharing it.");
      return;
    }

    const url = `${window.location.origin}/forms/${form.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: form.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setSharedFormId(form.id);
        window.setTimeout(() => setSharedFormId(null), 2200);
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") setError("Could not share this form.");
    }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center"><p className="opacity-60">Loading forms...</p></main>;

  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      {dialog}
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={() => router.push("/admin")} className="text-sm opacity-60 hover:opacity-100">Back to Dashboard</button>
        <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm uppercase tracking-[0.18em] opacity-50">Admin only</p><h1 className="mt-2 text-4xl font-bold">Forms</h1><p className="mt-2 opacity-60">Build forms, publish them, and review responses.</p></div>
          <Link href="/admin/forms/new" className="rounded-lg bg-dark px-5 py-3 text-center font-medium text-light dark:bg-light dark:text-dark">+ New form</Link>
        </div>
        {error && <p className="mt-6 rounded-lg border border-red-500/30 p-4 text-red-600">{error}</p>}
        <div className="mt-10 space-y-4">
          {forms.length === 0 && <div className="rounded-2xl border border-dashed border-dark/20 p-12 text-center opacity-60">No forms yet.</div>}
          {forms.map((form) => <article key={form.id} className="rounded-2xl border border-dark/15 p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">{form.title}</h2><p className="mt-2 text-sm opacity-60">/{form.slug} · {form.status} · {(form.form_questions || []).length} questions</p></div><div className="flex flex-wrap gap-3"><Link href={`/admin/forms/${form.id}/edit`} className="rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium">Edit</Link><Link href={`/admin/forms/${form.id}/responses`} className="rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium">Responses</Link>{form.status === "published" && <a href={`/forms/${form.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium">View</a>}<button type="button" onClick={() => share(form)} className="rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium">{sharedFormId === form.id ? "Copied" : "Share"}</button><button type="button" onClick={() => remove(form)} className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-600">Delete</button></div></div></article>)}
        </div>
      </div>
    </main>
  );
}
