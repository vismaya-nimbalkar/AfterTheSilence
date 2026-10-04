import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";

const BUCKET = "form-question-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || getUserRole(user) !== "admin") {
      return NextResponse.json({ error: "Only administrators can upload form images." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Please choose an image." }, { status: 400 });
    }
    if (!file.type?.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
    const extension = file.name?.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not upload image." }, { status: 500 });
  }
}