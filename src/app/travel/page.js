import TravelPageContent from "@/src/components/TravelPageContent";
import { notFound } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { getTravelFeatureEnabled } from "@/src/lib/travelFeature";

export const metadata = { title: "Travel advisories" };

export default async function TravelPage() {
  const supabase = await createClient();
  if (!await getTravelFeatureEnabled(supabase)) notFound();

  const { data } = await supabase
    .from("travel_countries")
    .select("id, country_name, map_id, country_code, status, notes, advisories")
    .eq("published", true)
    .order("country_name", { ascending: true });

  return <TravelPageContent countries={data || []} />;
}