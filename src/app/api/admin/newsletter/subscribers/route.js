import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || getUserRole(user) !== "admin") {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  return { user };
}

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { data, error } = await createAdminClient()
      .from("newsletter_subscribers")
      .select("id, email, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ subscribers: data || [] });
  } catch (error) {
    console.error("Newsletter subscribers GET error:", error);
    return NextResponse.json({ error: error?.message || "Could not load subscribers." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Subscriber ID is required." }, { status: 400 });

    const { error } = await createAdminClient()
      .from("newsletter_subscribers")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Newsletter subscriber DELETE error:", error);
    return NextResponse.json({ error: error?.message || "Could not remove subscriber." }, { status: 500 });
  }
}
