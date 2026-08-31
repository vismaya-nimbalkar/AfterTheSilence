import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getUserRole } from "@/src/lib/admin/permissions";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || getUserRole(user) !== "admin") {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  return { user };
}

export async function GET() {
  try {
    const { response } = await requireAdmin();

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

    return NextResponse.json({ editors: data || [] });
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
    const { response, user: adminUser } = await requireAdmin();

    if (response) {
      return response;
    }

    const body = await request.json();
    const email = body.email?.trim();
    const password = body.password;
    const name = body.name?.trim() || email;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Please enter both email and password." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "editor",
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
        role: "editor",
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

    return NextResponse.json({ editor }, { status: 201 });
  } catch (error) {
    console.error("Editor accounts POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Could not create editor account." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { response } = await requireAdmin();

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
      .select("id, user_id")
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

    const { error: deleteAccountError } = await supabaseAdmin
      .from("editor_accounts")
      .delete()
      .eq("id", id);

    if (deleteAccountError) {
      return NextResponse.json(
        { error: deleteAccountError.message || "Could not delete editor account." },
        { status: 500 }
      );
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      editor.user_id
    );

    if (deleteUserError) {
      console.error("Could not delete editor login:", deleteUserError);
      return NextResponse.json(
        { error: deleteUserError.message || "Editor record deleted, but login could not be removed." },
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