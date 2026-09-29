const EMPTY_SITE_SETTINGS = {
  contact_phone: "",
  contact_email: "",
};

export async function getSiteSettings(supabase) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("contact_phone, contact_email")
    .eq("id", "global")
    .maybeSingle();

  if (error || !data) return EMPTY_SITE_SETTINGS;

  return {
    contact_phone: data.contact_phone || "",
    contact_email: data.contact_email || "",
  };
}