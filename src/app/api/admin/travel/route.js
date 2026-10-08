import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";
import { getTravelFeatureEnabled } from "@/src/lib/travelFeature";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || getUserRole(user) !== "admin") {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  return { user };
}

function cleanCountry(body) {
  const advisories = Array.isArray(body.advisories)
    ? body.advisories
        .map((advisory) => ({
          title: String(advisory.title || "").trim(),
          url: String(advisory.url || "").trim(),
        }))
        .filter((advisory) => advisory.title && advisory.url)
    : [];

  return {
    country_name: String(body.country_name || "").trim(),
    map_id: String(body.map_id || "").trim(),
    country_code: String(body.country_code || "").trim().toLowerCase(),
    status: String(body.status || "caution").trim(),
    notes: String(body.notes || "").trim(),
    advisories,
    last_edited_at: body.last_edited_at || null,
  };
}

function hasValidDate(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("travel_countries")
      .select("*")
      .order("country_name", { ascending: true });

    if (error) throw error;
    const { data: setting } = await supabaseAdmin
      .from("travel_settings")
      .select("enabled")
      .eq("id", "global")
      .maybeSingle();

    return NextResponse.json({ countries: data || [], featureEnabled: setting?.enabled !== false });
  } catch (error) {
    console.error("Travel countries GET error:", error);
    return NextResponse.json({ error: error?.message || "Could not load travel countries." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { enabled } = await request.json();
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Enabled must be a boolean." }, { status: 400 });
    }

    const { data, error } = await createAdminClient()
      .from("travel_settings")
      .upsert({ id: "global", enabled }, { onConflict: "id" })
      .select("enabled")
      .single();

    if (error) throw error;
    return NextResponse.json({ featureEnabled: data.enabled });
  } catch (error) {
    console.error("Travel feature toggle error:", error);
    return NextResponse.json({ error: error?.message || "Could not update travel visibility." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const requestBody = await request.json();
    const body = cleanCountry(requestBody);
    if (!body.country_name || !body.map_id || !body.country_code) {
      return NextResponse.json({ error: "Country, map ID, and two-letter country code are required." }, { status: 400 });
    }

    if (!hasValidDate(body.last_edited_at)) {
      return NextResponse.json({ error: "Enter a valid last edited date." }, { status: 400 });
    }

    const saveAsDraft = requestBody.save_as_draft === true;

    const { data, error } = await createAdminClient()
      .from("travel_countries")
      .insert({
        ...body,
        published: !saveAsDraft,
        draft: saveAsDraft ? body : null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ country: data }, { status: 201 });
  } catch (error) {
    console.error("Travel countries POST error:", error);
    return NextResponse.json({ error: error?.message || "Could not save travel country." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { id, save_as_draft: saveAsDraft, ...payload } = await request.json();
    if (!id) return NextResponse.json({ error: "Country ID is required." }, { status: 400 });

    const body = cleanCountry(payload);
    if (!body.country_name || !body.map_id || !body.country_code) {
      return NextResponse.json({ error: "Country, map ID, and two-letter country code are required." }, { status: 400 });
    }

    if (!hasValidDate(body.last_edited_at)) {
      return NextResponse.json({ error: "Enter a valid last edited date." }, { status: 400 });
    }

    const update = saveAsDraft === true
      ? { draft: body, updated_at: new Date().toISOString() }
      : { ...body, published: true, draft: null, updated_at: new Date().toISOString() };

    const { data, error } = await createAdminClient()
      .from("travel_countries")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ country: data });
  } catch (error) {
    console.error("Travel countries PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Could not update travel country." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Country ID is required." }, { status: 400 });

    const { error } = await createAdminClient().from("travel_countries").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Travel countries DELETE error:", error);
    return NextResponse.json({ error: error?.message || "Could not delete travel country." }, { status: 500 });
  }
}