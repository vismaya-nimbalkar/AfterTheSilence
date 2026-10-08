import AboutCoverSection from "@/src/components/About/AboutCoverSection";
import { createClient } from "@/src/lib/supabase/server";
import { getSiteSettings } from "@/src/lib/siteSettings";

export const metadata = {
  title: "About Us",
  description: `The Heart`,
};

export default async function About() {
  const settings = await getSiteSettings(await createClient());

  return (
    <>
      <AboutCoverSection settings={settings} />
    </>
  );
}
