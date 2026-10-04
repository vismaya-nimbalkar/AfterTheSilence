import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";

export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || getUserRole(user) !== "admin") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const { data, error } = await createAdminClient().from("form_responses").select("*").eq("form_id", id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ responses: data || [] });
}

export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || getUserRole(user) !== "admin") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id: formId } = await params;
  const { responseId } = await request.json();
  if (!responseId) return NextResponse.json({ error: "Response ID is required." }, { status: 400 });

  const { error } = await createAdminClient()
    .from("form_responses")
    .delete()
    .eq("id", responseId)
    .eq("form_id", formId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
