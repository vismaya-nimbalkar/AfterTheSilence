import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import {
  EDITOR_PERMISSION_DEFAULTS,
  canManageStaffAccounts,
  getEditorPermissions,
  getUserRole,
} from "@/src/lib/admin/permissions";
import { getPasswordPolicyError } from "@/src/lib/auth/passwordPolicy";

async function requireAccountManager() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !canManageStaffAccounts(user)) {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  return { user };
}

export async function GET() {
  try {
    const { response } = await requireAccountManager();

    if (response) {
      return response;
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("editor_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load editor accounts:", error);
      return NextResponse.json(
        { error: error.message || "Could not load editor accounts." },
        { status: 500 }
      );
    }

    const editors = await Promise.all(
      (data || []).map(async (editor) => {
        const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(
          editor.user_id
        );
        if (authUserError || !authUser?.user) {
          throw authUserError || new Error(`Could not load account ${editor.email}.`);
        }

        const metadata = authUser?.user?.user_metadata || {};
        const accountType = getUserRole(authUser.user) === "admin" ? "admin" : "editor";

        return {
          ...editor,
          accountType,
          canDelete: accountType === "editor" || authUser.user.app_metadata?.delegated_admin === true,
          permissions: getEditorPermissions(authUser.user),
          mfaEnabled: metadata.security_mfa_enabled === true,
          securitySetupRequired: metadata.security_reset_required === true,
        };
      })
    );

    return NextResponse.json({ editors });
  } catch (error) {
    console.error("Editor accounts GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Could not load editor accounts." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { response, user: adminUser } = await requireAccountManager();

    if (response) {
      return response;
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = body.password;
    const name = (typeof body.name === "string" ? body.name.trim() : "") || email;
    const accountType = body.accountType || "editor";
    if (!["editor", "admin"].includes(accountType)) {
      return NextResponse.json({ error: "Choose either an editor or administrator account." }, { status: 400 });
    }
    const permissions = Object.fromEntries(
      Object.entries(EDITOR_PERMISSION_DEFAULTS).map(([permission, defaultValue]) => [
        permission,
        typeof body.permissions?.[permission] === "boolean"
          ? body.permissions[permission]
          : defaultValue,
      ])
    );

    if (!email || typeof password !== "string" || !password) {
      return NextResponse.json(
        { error: "Please enter both email and password." },
        { status: 400 }
      );
    }

    const passwordPolicyError = getPasswordPolicyError(password);
    if (passwordPolicyError) {
      return NextResponse.json(
        { error: passwordPolicyError },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          role: accountType,
          ...(accountType === "editor"
            ? { editor_permissions: permissions }
            : { delegated_admin: true }),
        },
        user_metadata: {
          role: accountType,
          display_name: name,
        },
      });

    if (createUserError) {
      return NextResponse.json(
        { error: createUserError.message || "Could not create editor account." },
        { status: 400 }
      );
    }

    const { data: editor, error: insertError } = await supabaseAdmin
      .from("editor_accounts")
      .insert({
        user_id: createdUser.user.id,
        email,
        name,
        role: accountType,
        created_by: adminUser.id,
      })
      .select()
      .single();

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
      return NextResponse.json(
        { error: insertError.message || "Could not save editor account." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      editor: {
        ...editor,
        accountType,
        canDelete: true,
        permissions: accountType === "editor" ? permissions : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Editor accounts POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Could not create editor account." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { response } = await requireAccountManager();

    if (response) {
      return response;
    }

    const body = await request.json();
    const { id, requiresMFA = true } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Editor ID is required." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: editor, error: lookupError } = await supabaseAdmin
      .from("editor_accounts")
      .select("user_id, role")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: lookupError.message || "Could not find editor account." },
        { status: 500 }
      );
    }

    if (!editor) {
      return NextResponse.json(
        { error: "Editor account not found." },
        { status: 404 }
      );
    }

    const { data: authUser, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(editor.user_id);

    if (authUserError) {
      return NextResponse.json(
        { error: authUserError.message || "Could not load editor account." },
        { status: 500 }
      );
    }

    if (body.profile !== undefined) {
      if (!body.profile || typeof body.profile !== "object" || Array.isArray(body.profile)) {
        return NextResponse.json({ error: "Account details must be an object." }, { status: 400 });
      }

      const name = typeof body.profile.name === "string" ? body.profile.name.trim() : "";
      const email = typeof body.profile.email === "string" ? body.profile.email.trim() : "";
      if (!name) {
        return NextResponse.json({ error: "Name is required." }, { status: 400 });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
      }

      const originalUser = authUser?.user;
      if (!originalUser) {
        return NextResponse.json({ error: "Could not load editor account." }, { status: 500 });
      }

      const { data: updatedAuthUser, error: authUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(editor.user_id, {
          email,
          email_confirm: true,
          user_metadata: {
            ...(originalUser.user_metadata || {}),
            display_name: name,
          },
        });

      if (authUpdateError) {
        return NextResponse.json(
          { error: authUpdateError.message || "Could not update account details." },
          { status: 400 }
        );
      }

      const updatedEmail = updatedAuthUser?.user?.email || email;
      const { data: updatedEditor, error: accountUpdateError } = await supabaseAdmin
        .from("editor_accounts")
        .update({ email: updatedEmail, name })
        .eq("id", id)
        .select("id, email, name")
        .single();

      if (accountUpdateError) {
        const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(
          editor.user_id,
          {
            email: originalUser.email,
            email_confirm: true,
            user_metadata: originalUser.user_metadata || {},
          }
        );
        if (rollbackError) {
          console.error("Could not roll back account profile update:", rollbackError);
          return NextResponse.json(
            {
              error: `The account record could not be updated, and the Auth changes could not be rolled back: ${accountUpdateError.message}`,
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: accountUpdateError.message || "Could not update account details." },
          { status: 500 }
        );
      }

      return NextResponse.json({ editor: updatedEditor });
    }

    const accountType = getUserRole(authUser?.user);
    if (accountType !== "editor") {
      return NextResponse.json({ error: "Administrator accounts cannot be modified here." }, { status: 403 });
    }

    if (body.permissions !== undefined) {
      if (!body.permissions || typeof body.permissions !== "object" || Array.isArray(body.permissions)) {
        return NextResponse.json({ error: "Editor permissions must be an object." }, { status: 400 });
      }

      for (const permission of Object.keys(EDITOR_PERMISSION_DEFAULTS)) {
        if (typeof body.permissions[permission] !== "boolean") {
          return NextResponse.json({ error: `The ${permission} permission must be enabled or disabled.` }, { status: 400 });
        }
      }

      const permissions = Object.fromEntries(
        Object.keys(EDITOR_PERMISSION_DEFAULTS).map((permission) => [
          permission,
          body.permissions[permission],
        ])
      );
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        editor.user_id,
        {
          app_metadata: {
            ...authUser.user.app_metadata,
            role: "editor",
            editor_permissions: permissions,
          },
        }
      );

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || "Could not update editor permissions." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, permissions });
    }

    if (authUser?.user?.user_metadata?.security_reset_required === true) {
      return NextResponse.json(
        { error: "A security request is already pending for this editor." },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      editor.user_id,
      {
        user_metadata: {
          ...authUser.user.user_metadata,
          security_mfa_required: requiresMFA,
          security_reset_required: true,
          security_password_changed: false,
        },
      }
    );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Could not require security setup." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Editor security reset error:", error);
    return NextResponse.json(
      { error: error?.message || "Could not require security setup." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { response, user: adminUser } = await requireAccountManager();

    if (response) {
      return response;
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Editor ID is required." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: editor, error: lookupError } = await supabaseAdmin
      .from("editor_accounts")
      .select("id, user_id, role")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: lookupError.message || "Could not find editor account." },
        { status: 500 }
      );
    }

    if (!editor) {
      return NextResponse.json(
        { error: "Editor account not found." },
        { status: 404 }
      );
    }

    if (editor.user_id === adminUser.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    const { data: targetAuthUser, error: targetAuthUserError } =
      await supabaseAdmin.auth.admin.getUserById(editor.user_id);
    if (targetAuthUserError) {
      return NextResponse.json(
        { error: targetAuthUserError.message || "Could not verify account." },
        { status: 500 }
      );
    }
    if (
      getUserRole(targetAuthUser?.user) === "admin" &&
      targetAuthUser?.user?.app_metadata?.delegated_admin !== true
    ) {
      return NextResponse.json({ error: "The primary administrator account cannot be deleted here." }, { status: 403 });
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      editor.user_id
    );

    if (deleteUserError) {
      console.error("Could not delete account login:", deleteUserError);
      return NextResponse.json(
        { error: deleteUserError.message || "Could not remove the account login." },
        { status: 500 }
      );
    }

    const { error: deleteAccountError } = await supabaseAdmin
      .from("editor_accounts")
      .delete()
      .eq("id", id);

    if (deleteAccountError) {
      console.error("Could not delete account record:", deleteAccountError);
      return NextResponse.json(
        { error: `The login was removed, but its account record could not be deleted: ${deleteAccountError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Editor accounts DELETE error:", error);
    return NextResponse.json(
      { error: error?.message || "Could not delete editor account." },
      { status: 500 }
    );
  }
}