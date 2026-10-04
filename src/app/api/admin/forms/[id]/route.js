import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";
import { normalizeQuestions, slugify } from "@/src/lib/forms";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || getUserRole(user) !== "admin") return { response: NextResponse.json({ error: "Only administrators can manage forms." }, { status: 401 }) };
  return { supabaseAdmin: createAdminClient() };
}

export async function GET(request, { params }) {
  try {
    const { response, supabaseAdmin } = await requireAdmin();
    if (response) return response;
    const { id } = await params;
    const { data, error } = await supabaseAdmin.from("forms").select("*, form_questions(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    return NextResponse.json({ form: data });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not load form." }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { response, supabaseAdmin } = await requireAdmin();
    if (response) return response;
    const { id } = await params;
    const body = await request.json();
    const title = String(body.title || "Untitled form").trim().slice(0, 200);
    const update = {
      title,
      description: String(body.description || "").trim().slice(0, 5000),
      slug: slugify(body.slug || title) || `form-${Date.now()}`,
      status: ["draft", "published", "closed"].includes(body.status) ? body.status : "draft",
      settings: { collectEmail: Boolean(body.settings?.collectEmail), limitOneResponse: Boolean(body.settings?.limitOneResponse), sendResponseReceipt: Boolean(body.settings?.sendResponseReceipt) },
      confirmation_message: String(body.confirmation_message || "Your response has been recorded.").trim().slice(0, 1000),
      confirmation_image_url: String(body.confirmation_image_url || "").trim(),
      updated_at: new Date().toISOString(),
    };
    const { data: form, error } = await supabaseAdmin.from("forms").update(update).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const questions = normalizeQuestions(body.questions);
    const { error: deleteError } = await supabaseAdmin.from("form_questions").delete().eq("form_id", id);
    if (deleteError) throw deleteError;
    if (questions.length) {
      const { error: insertError } = await supabaseAdmin.from("form_questions").insert(questions.map((question) => ({ ...question, form_id: id })));
      if (insertError) throw insertError;
    }
    return NextResponse.json({ form: { ...form, form_questions: questions } });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not save form." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { response, supabaseAdmin } = await requireAdmin();
    if (response) return response;
    const { id } = await params;
    const { error } = await supabaseAdmin.from("forms").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not delete form." }, { status: 500 });
  }
}
