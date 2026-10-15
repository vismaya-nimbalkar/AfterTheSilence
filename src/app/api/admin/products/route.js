import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { hasEditorPermission } from "@/src/lib/admin/permissions";
import { slugify } from "@/src/lib/forms";

async function getAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  if (!hasEditorPermission(user, "shop")) {
    return {
      response: NextResponse.json({ error: "You do not have permission to manage products." }, { status: 403 }),
    };
  }

  return { supabaseAdmin: createAdminClient() };
}

function getProductPayload(body, { partial = false } = {}) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const price = Number(body.price);

  if (!title) {
    return { error: "Product title is required." };
  }
  if (body.price === "" || body.price === null || !Number.isFinite(price) || price < 0) {
    return { error: "Enter a valid product price." };
  }

  const slug = slugify(body.slug || title);
  if (!slug) {
    return { error: "A valid product URL slug is required." };
  }

  const payload = {
    title,
    slug,
    description: typeof body.description === "string" ? body.description.trim() : "",
    price,
    images: Array.isArray(body.images) ? body.images.filter((image) => typeof image === "string" && image) : [],
    qikink_sku: typeof body.qikink_sku === "string" ? body.qikink_sku.trim() : null,
  };
  const isPod = body.is_pod !== undefined ? Boolean(body.is_pod) : true;
  payload.is_pod = isPod;
  if (!isPod) payload.qikink_sku = null;

  if (body.is_in_stock !== undefined) payload.is_in_stock = Boolean(body.is_in_stock);
  else if (!partial) payload.is_in_stock = true;

  if (body.is_published !== undefined) payload.is_published = Boolean(body.is_published);
  else if (!partial) payload.is_published = true;

  return { payload };
}

export async function GET(request) {
  try {
    const { response, supabaseAdmin } = await getAdminClient();
    if (response) return response;

    const id = new URL(request.url).searchParams.get("id");
    let query = supabaseAdmin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (id) query = query.eq("id", id);

    const { data, error } = id
      ? await query.maybeSingle()
      : await query;

    if (error) throw error;
    if (id && !data) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json(id ? { product: data } : { products: data || [] });
  } catch (error) {
    console.error("Admin products GET error:", error);
    return NextResponse.json({ error: error.message || "Could not load products." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { response, supabaseAdmin } = await getAdminClient();
    if (response) return response;

    const body = await request.json();
    const { payload, error: validationError } = getProductPayload(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (payload.is_pod && (!payload.qikink_sku || payload.qikink_sku.length > 50)) {
      return NextResponse.json({ error: "Enter the Qikink SKU from your My Products catalog (up to 50 characters)." }, { status: 400 });
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .insert(payload)
      .select()
      .single();

    if (productError) throw productError;

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error("Admin product create error:", error);
    return NextResponse.json({ error: error.message || "Could not create product." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { response, supabaseAdmin } = await getAdminClient();
    if (response) return response;

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
    }

    const { payload, error: validationError } = getProductPayload(body, { partial: true });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    if (payload.is_pod && (!payload.qikink_sku || payload.qikink_sku.length > 50)) {
      return NextResponse.json({ error: "Enter the Qikink SKU from your My Products catalog (up to 50 characters)." }, { status: 400 });
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .update(payload)
      .eq("id", body.id)
      .select()
      .maybeSingle();

    if (productError) throw productError;
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Admin product update error:", error);
    return NextResponse.json({ error: error.message || "Could not update product." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { response, supabaseAdmin } = await getAdminClient();
    if (response) return response;

    const { id, is_in_stock: isInStock } = await request.json();
    if (!id || typeof isInStock !== "boolean") {
      return NextResponse.json({ error: "Product ID and stock availability are required." }, { status: 400 });
    }

    const { data: product, error } = await supabaseAdmin
      .from("products")
      .update({ is_in_stock: isInStock })
      .eq("id", id)
      .select("id, is_in_stock")
      .maybeSingle();
    if (error) throw error;
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Admin product stock update error:", error);
    return NextResponse.json({ error: error.message || "Could not update stock availability." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { response, supabaseAdmin } = await getAdminClient();
    if (response) return response;

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Product ID is required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("products").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Admin product delete error:", error);
    return NextResponse.json({ error: error.message || "Could not delete product." }, { status: 500 });
  }
}
