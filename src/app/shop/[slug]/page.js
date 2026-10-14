import { notFound } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";
import { getShopEnabled } from "@/src/lib/siteSettings";
import ProductClient from "./ProductClient";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params, searchParams }) {
  const [routeParams, query] = await Promise.all([params, searchParams]);
  const preview = query?.preview === "1";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = Boolean(user && getUserRole(user) === "admin");
  const shopEnabled = await getShopEnabled(createAdminClient());

  if (preview && !isAdmin) notFound();
  if (!preview && !shopEnabled && !isAdmin) notFound();

  return <ProductClient slug={routeParams.slug} preview={preview} />;
}
