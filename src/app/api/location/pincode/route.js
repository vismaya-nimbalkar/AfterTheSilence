import { NextResponse } from "next/server";

export async function GET(request) {
  const pin = new URL(request.url).searchParams.get("pin") || "";
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "Enter a valid six-digit PIN code." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`PIN lookup service returned ${response.status}.`);
    }

    const [result] = await response.json();
    const postOffice = result?.Status === "Success" ? result.PostOffice?.[0] : null;
    if (!postOffice) {
      return NextResponse.json({ error: "No address was found for this PIN code." }, { status: 404 });
    }

    return NextResponse.json({
      city: postOffice.District || postOffice.Name || "",
      state: postOffice.State || "",
    });
  } catch (error) {
    console.error("PIN code lookup error:", error);
    return NextResponse.json(
      { error: error.message || "PIN lookup service is unavailable." },
      { status: 502 }
    );
  }
}
