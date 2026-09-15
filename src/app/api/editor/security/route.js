import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";

async function getEditor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || getUserRole(user) !== "editor") {
    return { supabase, response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  return { supabase, user };
}

export async function PATCH(request) {
  try {
    const { supabase, response, user } = await getEditor();

    if (response) {
      return response;
    }

    const { step, enabled = true } = await request.json();
    const supabaseAdmin = createAdminClient();

    const { data: currentUser, error: currentUserError } =
      await supabaseAdmin.auth.admin.getUserById(user.id);

    if (currentUserError || !currentUser?.user) {
      throw currentUserError || new Error("Could not load editor account.");
    }

    const metadata = currentUser.user.user_metadata || {};

    if (step === "mfa") {
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        throw factorsError;
      }

      const hasVerifiedTotp = factors?.totp?.some(
        (factor) => factor.status === "verified"
      );

      if (enabled && !hasVerifiedTotp) {
        return NextResponse.json(
          { error: "No verified two-factor authentication factor found." },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...metadata,
          security_mfa_enabled: hasVerifiedTotp,
        },
      });

      if (error) {
        throw error;
      }

      return NextResponse.json({ success: true });
    }

    if (step === "password") {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...metadata,
          security_password_changed: true,
        },
      });

      if (error) {
        throw error;
      }

      return NextResponse.json({ success: true });
    }

    if (step !== "complete" || metadata.security_password_changed !== true) {
      return NextResponse.json(
        { error: "Change your password before completing security setup." },
        { status: 400 }
      );
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      throw factorsError;
    }

    const hasVerifiedTotp = factors?.totp?.some(
      (factor) => factor.status === "verified"
    );

    if (metadata.security_mfa_required !== false && !hasVerifiedTotp) {
      return NextResponse.json(
        { error: "Enable two-factor authentication before completing setup." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...metadata,
          security_mfa_enabled: hasVerifiedTotp || metadata.security_mfa_enabled === true,
          security_reset_required: false,
          security_password_changed: true,
        },
      }
    );

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Editor security setup error:", error);
    return NextResponse.json(
      { error: error?.message || "Could not complete security setup." },
      { status: 500 }
    );
  }
}