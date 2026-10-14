import { notFound } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";
import { getShopEnabled } from "@/src/lib/siteSettings";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }) {
  const query = await searchParams;
  const preview = query?.preview === "1";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = Boolean(user && getUserRole(user) === "admin");

  if (preview) {
    if (!isAdmin) notFound();
  } else if (!(await getShopEnabled(createAdminClient())) && !isAdmin) {
    notFound();
  }

  return <CheckoutClient preview={preview} />;
}
