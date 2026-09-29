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
      .from("site_settings")
      .select("contact_phone, contact_email")
      .eq("id", "global")
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({
      contact_phone: data?.contact_phone || "",
      contact_email: data?.contact_email || "",
    });
  } catch (error) {
    console.error("Site settings GET error:", error);
    return NextResponse.json({ error: error?.message || "Could not load site settings." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();
    const contactPhone = String(body.contact_phone || "").trim();
    const contactEmail = String(body.contact_email || "").trim();

    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const { data, error } = await createAdminClient()
      .from("site_settings")
      .upsert({
        id: "global",
        contact_phone: contactPhone,
        contact_email: contactEmail,
      }, { onConflict: "id" })
      .select("contact_phone, contact_email")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Site settings PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Could not save site settings." }, { status: 500 });
  }
}