import { Resend } from "resend";
import { createHmac } from "node:crypto";
import { createClient } from "@/src/lib/supabase/server";
import { getUserRole } from "@/src/lib/admin/permissions";
import siteMetadata from "@/src/utils/siteMetaData";

const resend = new Resend(process.env.RESEND_API_KEY);

function createUnsubscribeUrl(email) {
  const token = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update(email)
    .digest("hex");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || siteMetadata.siteUrl;
  return `${siteUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

export async function POST(request) {
  try {
    // Check Supabase authentication
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || getUserRole(user) !== "admin") {
      return Response.json(
        { error: "Only administrators can send newsletters." },
        { status: 401 }
      );
    }

    // Read request body
    const body = await request.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return Response.json(
        { error: "Missing email information." },
        { status: 400 }
      );
    }

    const recipients = Array.isArray(to) ? to : [to];
    const from = "After The Silence <hello@afterthesilence.org>";

    // Build unique email payloads for each recipient
    const batchPayloads = recipients.map((recipient) => {
      const unsubscribeUrl = createUnsubscribeUrl(recipient);
      const emailHtml = `${html}
        <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e5e5;color:#777;font:12px/1.5 Arial,sans-serif;text-align:center">
          You are receiving this email because you subscribed to After The Silence.<br>
          <a href="${unsubscribeUrl}" style="color:#777">Unsubscribe from this newsletter</a>
        </div>`;

      return {
        from,
        to: recipient, // Individual address
        subject,
        html: emailHtml,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    // Send batch via Resend API
    const { data, error } = await resend.batch.send(batchPayloads);

    if (error) {
      console.error("Resend batch error:", error);
      return Response.json({ error: error.message || "Could not send batch email." }, { status: 500 });
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Newsletter API error:", error);
    return Response.json(
      { error: "Something went wrong while sending the email." },
      { status: 500 }
    );
  }
}