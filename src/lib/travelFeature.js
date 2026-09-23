export async function getTravelFeatureEnabled(supabase) {
  const { data, error } = await supabase
    .from("travel_settings")
    .select("enabled")
    .eq("id", "global")
    .maybeSingle();

  if (error || !data) return true;
  return data.enabled !== false;
}