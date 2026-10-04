import { notFound } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import PublicForm from "@/src/components/Forms/PublicForm";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }) {
  const { slug } = await params;
  const { data: form } = await createClient().then((supabase) => supabase.from("forms").select("*, form_questions(*)").eq("slug", slug).eq("status", "published").maybeSingle());
  if (!form) notFound();
  return <PublicForm form={form} />;
}
