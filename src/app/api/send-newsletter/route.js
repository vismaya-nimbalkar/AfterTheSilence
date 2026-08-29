import { Resend } from "resend";
import { createClient } from "@/src/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    // Check Supabase authentication
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    // Read request body
    const body = await request.json();

    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return Response.json(
        {
          error: "Missing email information.",
        },
        {
          status: 400,
        }
      );
    }

    const recipients = Array.isArray(to)
      ? to
      : [to];

    // Send through Resend
    const { data, error } = await resend.emails.send({
      from: "After The Silence <hello@afterthesilence.org>",
      to: recipients,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);

      return Response.json(
        {
          error:
            error.message ||
            "Could not send email.",
        },
        {
          status: 500,
        }
      );
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Newsletter API error:",
      error
    );

    return Response.json(
      {
        error:
          "Something went wrong while sending the email.",
      },
      {
        status: 500,
      }
    );
  }
}