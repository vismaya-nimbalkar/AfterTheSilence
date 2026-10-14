import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";
import { getShopEnabled } from "@/src/lib/siteSettings";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get("preview") === "1";
    if (preview) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || getUserRole(user) !== "admin") {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
    }

    const supabaseAdmin = createAdminClient();
    if (!preview && !(await getShopEnabled(supabaseAdmin))) {
      return NextResponse.json({ error: "The shop is currently unavailable.", shopDisabled: true }, { status: 404 });
    }

    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ products: products || [] });
  } catch (error) {
    console.error("Shop products GET error:", error);
    return NextResponse.json({ error: error.message || "Could not load products." }, { status: 500 });
  }
}
