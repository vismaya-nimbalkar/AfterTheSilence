import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";
import { normalizeQuestions, slugify } from "@/src/lib/forms";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || getUserRole(user) !== "admin") {
    return { response: NextResponse.json({ error: "Only administrators can manage forms." }, { status: 401 }) };
  }
  return { user, supabaseAdmin: createAdminClient() };
}

function cleanForm(body, user) {
  const title = String(body.title || "Untitled form").trim().slice(0, 200);
  return {
    title,
    description: String(body.description || "").trim().slice(0, 5000),
    slug: slugify(body.slug || title) || `form-${Date.now()}`,
    status: ["draft", "published", "closed"].includes(body.status) ? body.status : "draft",
    settings: {
      collectEmail: Boolean(body.settings?.collectEmail),
      limitOneResponse: Boolean(body.settings?.limitOneResponse),
      sendResponseReceipt: Boolean(body.settings?.sendResponseReceipt),
    },
    confirmation_message: String(body.confirmation_message || "Your response has been recorded.").trim().slice(0, 1000),
    confirmation_image_url: String(body.confirmation_image_url || "").trim(),
    created_by: user.id,
  };
}

export async function GET() {
  try {
    const { response, supabaseAdmin } = await requireAdmin();
    if (response) return response;
    const { data, error } = await supabaseAdmin.from("forms").select("*, form_questions(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ forms: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not load forms." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { response, user, supabaseAdmin } = await requireAdmin();
    if (response) return response;
    const body = await request.json();
    const formData = cleanForm(body, user);
    const { data: form, error } = await supabaseAdmin.from("forms").insert(formData).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const questions = normalizeQuestions(body.questions);
    if (questions.length) {
      const { error: questionError } = await supabaseAdmin.from("form_questions").insert(questions.map((question) => ({ ...question, form_id: form.id })));
      if (questionError) throw questionError;
    }
    return NextResponse.json({ form: { ...form, form_questions: questions } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not create form." }, { status: 500 });
  }
}
