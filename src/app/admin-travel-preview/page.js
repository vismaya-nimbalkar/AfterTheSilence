import { redirect } from "next/navigation";
import TravelPageContent from "@/src/components/TravelPageContent";
import { createClient } from "@/src/lib/supabase/server";
import { getUserRole } from "@/src/lib/admin/permissions";

export const metadata = { title: "Travel preview" };

export default async function AdminTravelPreviewPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user || getUserRole(user) !== "admin") {
    redirect("/forbidden");
  }

  const { data } = await supabase
    .from("travel_countries")
    .select("id, country_name, map_id, country_code, status, notes, advisories")
    .eq("published", true)
    .order("country_name", { ascending: true });

  return <TravelPageContent countries={data || []} />;
}