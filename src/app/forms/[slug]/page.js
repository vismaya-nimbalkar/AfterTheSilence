import { notFound } from "next/navigation";
import { createAdminClient } from "@/src/lib/supabase/admin";
import PublicForm from "@/src/components/Forms/PublicForm";
import { slugify } from "@/src/lib/forms";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }) {
  const { slug } = await params;
  const normalizedSlug = slugify(slug);
  if (!normalizedSlug) notFound();

  const { data: form, error } = await createAdminClient()
    .from("forms")
    .select("*, form_questions(*)")
    .ilike("slug", normalizedSlug)
    .maybeSingle();
  if (error) throw error;
  if (!form) notFound();

  const status = String(form.status || "").trim().toLowerCase();
  if (status === "closed") {
    return (
      <main className="min-h-screen px-6 py-20">
        <div className="mx-auto max-w-2xl rounded-2xl border border-dark/15 p-8 sm:p-12">
          <p className="text-sm uppercase tracking-[0.18em] opacity-50">Form closed</p>
          <h1 className="mt-4 text-3xl font-bold">{form.title}</h1>
          <p className="mt-4 whitespace-pre-wrap leading-7 opacity-70">
            {form.settings?.closedMessage || "This form isn't accepting responses right now."}
          </p>
        </div>
      </main>
    );
  }

  if (status !== "published") notFound();
  return <PublicForm form={form} />;
}
