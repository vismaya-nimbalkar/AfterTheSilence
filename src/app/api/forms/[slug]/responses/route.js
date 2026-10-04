import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { isAnswerEmpty } from "@/src/lib/forms";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function answerText(answer) {
  return Array.isArray(answer) ? answer.join(", ") : String(answer ?? "");
}

export async function POST(request, { params }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const supabaseAdmin = createAdminClient();
    const { data: form, error: formError } = await supabaseAdmin.from("forms").select("id, title, status, settings, confirmation_message, confirmation_image_url").eq("slug", slug).maybeSingle();
    if (formError) throw formError;
    if (!form || form.status !== "published") return NextResponse.json({ error: "This form is not accepting responses." }, { status: 404 });
    const { data: questions, error: questionError } = await supabaseAdmin.from("form_questions").select("id, title, type, required, options, validation").eq("form_id", form.id).order("position");
    if (questionError) throw questionError;
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    for (const question of questions || []) {
      const answer = answers[question.id];
      if (question.required && isAnswerEmpty(answer)) return NextResponse.json({ error: "Please answer all required questions." }, { status: 400 });
      if (question.type === "checkboxes" && !isAnswerEmpty(answer) && !Array.isArray(answer)) return NextResponse.json({ error: "Invalid checkbox response." }, { status: 400 });
      if (["multiple_choice", "dropdown"].includes(question.type) && !isAnswerEmpty(answer)) {
        const isOtherAnswer = question.type === "multiple_choice" && question.validation?.allowOther && typeof answer === "string" && answer.startsWith("Other: ");
        if (!isOtherAnswer && !question.options.includes(answer)) return NextResponse.json({ error: "Invalid choice response." }, { status: 400 });
        if (isOtherAnswer && answer.slice(7).trim() === "") return NextResponse.json({ error: "Please describe your other answer." }, { status: 400 });
      }
    }
    const email = String(body.respondentEmail || "").trim().toLowerCase();
    const needsEmail = form.settings?.collectEmail || form.settings?.sendResponseReceipt;
    if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    if (form.settings?.limitOneResponse && email) {
      const { count } = await supabaseAdmin.from("form_responses").select("id", { count: "exact", head: true }).eq("form_id", form.id).eq("respondent_email", email);
      if (count) return NextResponse.json({ error: "You have already submitted a response." }, { status: 409 });
    }
    const { error } = await supabaseAdmin.from("form_responses").insert({ form_id: form.id, answers, respondent_email: email, metadata: { userAgent: request.headers.get("user-agent") || "" } });
    if (error) throw error;

    let receiptSent = false;
    if (form.settings?.sendResponseReceipt) {
      const answerRows = (questions || []).map((question) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;vertical-align:top;">${escapeHtml(question.title)}</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap;">${escapeHtml(answerText(answers[question.id]) || "No answer")}</td></tr>`).join("");
      const { error: emailError } = await resend.emails.send({
        from: "After The Silence <hello@afterthesilence.org>",
        to: email,
        subject: `Your response to ${form.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#222;"><h1>${escapeHtml(form.title)}</h1><p>Here is a copy of your submitted response.</p><table style="width:100%;border-collapse:collapse;">${answerRows}</table></div>`,
      });
      if (emailError) console.error("Could not send form response receipt:", emailError);
      else receiptSent = true;
    }
    return NextResponse.json({ confirmationMessage: form.confirmation_message, confirmationImageUrl: form.confirmation_image_url, receiptSent });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not submit your response." }, { status: 500 });
  }
}
