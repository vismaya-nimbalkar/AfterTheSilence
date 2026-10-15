import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole, hasEditorPermission } from "@/src/lib/admin/permissions";
import { DEFAULT_SITE_SETTINGS, normalizeAboutBody } from "@/src/lib/siteSettings";

async function requireAdmin({ allowShopEditor = false } = {}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const isAdmin = getUserRole(user) === "admin";
  if (!isAdmin && !(allowShopEditor && hasEditorPermission(user, "shop"))) {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  return { user, isAdmin };
}

export async function GET() {
  try {
    const { response, isAdmin } = await requireAdmin({ allowShopEditor: true });
    if (response) return response;

    const { data, error } = await createAdminClient()
      .from("site_settings")
      .select("contact_phone, contact_email, about_heading, about_body, github_url, linkedin_url, instagram_url, reddit_url, discord_url, shop_enabled")
      .eq("id", "global")
      .maybeSingle();

    if (error) throw error;
    if (!isAdmin) return NextResponse.json({ shop_enabled: data?.shop_enabled ?? true });
    return NextResponse.json({
      ...DEFAULT_SITE_SETTINGS,
      ...(data || {}),
      about_body: normalizeAboutBody(data?.about_body),
    });
  } catch (error) {
    console.error("Site settings GET error:", error);
    return NextResponse.json({ error: error?.message || "Could not load site settings." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { response, isAdmin } = await requireAdmin({ allowShopEditor: true });
    if (response) return response;

    const body = await request.json();
    if (!isAdmin && Object.keys(body).some((key) => key !== "shop_enabled")) {
      return NextResponse.json({ error: "Shop editors may only update shop visibility." }, { status: 403 });
    }
    const contactPhone = String(body.contact_phone || "").trim();
    const contactEmail = String(body.contact_email || "").trim();
    const aboutHeading = String(body.about_heading || "").trim();
    const aboutBody = String(body.about_body || "").trim();

    // Social Links
    const githubUrl = String(body.github_url || "").trim();
    const linkedinUrl = String(body.linkedin_url || "").trim();
    const instagramUrl = String(body.instagram_url || "").trim();
    const redditUrl = String(body.reddit_url || "").trim();
    const discordUrl = String(body.discord_url || "").trim();
    if (body.shop_enabled !== undefined && typeof body.shop_enabled !== "boolean") {
      return NextResponse.json({ error: "Shop visibility must be enabled or disabled." }, { status: 400 });
    }

    if (body.contact_email !== undefined && contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const updates = { id: "global" };
    if (body.contact_phone !== undefined) updates.contact_phone = contactPhone;
    if (body.contact_email !== undefined) updates.contact_email = contactEmail;
    if (body.about_heading !== undefined) updates.about_heading = aboutHeading;
    if (body.about_body !== undefined) updates.about_body = normalizeAboutBody(aboutBody);
    if (body.github_url !== undefined) updates.github_url = githubUrl;
    if (body.linkedin_url !== undefined) updates.linkedin_url = linkedinUrl;
    if (body.instagram_url !== undefined) updates.instagram_url = instagramUrl;
    if (body.reddit_url !== undefined) updates.reddit_url = redditUrl;
    if (body.discord_url !== undefined) updates.discord_url = discordUrl;
    if (body.shop_enabled !== undefined) updates.shop_enabled = body.shop_enabled;

    const { data, error } = await createAdminClient()
      .from("site_settings")
      .upsert(updates, { onConflict: "id" })
      .select("contact_phone, contact_email, about_heading, about_body, github_url, linkedin_url, instagram_url, reddit_url, discord_url, shop_enabled")
      .single();

    if (error) throw error;
    if (!isAdmin) return NextResponse.json({ shop_enabled: data.shop_enabled });
    return NextResponse.json({ 
      ...DEFAULT_SITE_SETTINGS, 
      ...data, 
      about_body: normalizeAboutBody(data.about_body) 
    });
  } catch (error) {
    console.error("Site settings PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Could not save site settings." }, { status: 500 });
  }
}