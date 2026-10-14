import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { items, customerEmail, shippingAddress } = await req.json();

    const totalAmount = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_email: customerEmail,
        user_email: customerEmail,
        shipping_address: shippingAddress,
        items: items,
        total_amount: totalAmount,
        status: "Pending Cheque/DD Clearance",
        payment_method: "offline_mail",
      })
      .select()
      .single();

    if (error) throw error;

    // Send confirmation email via Resend
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: "After The Silence <orders@afterthesilence.org>",
        to: customerEmail,
        subject: `Order Confirmation #${order.id.slice(0, 8)} - After The Silence`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
            <h2>Thank you for your order!</h2>
            <p>Your order ID is: <strong>${order.id}</strong></p>
            <p>Status: <strong>Pending Cheque/DD Clearance</strong></p>
            
            <h3>Order Summary</h3>
            <ul>
              ${items
                .map(
                  (i) =>
                    `<li>${i.title} × ${i.quantity} - ₹${i.price * i.quantity}</li>`
                )
                .join("")}
            </ul>
            <p><strong>Total Amount: ₹${totalAmount}</strong></p>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />

            <h3>Mail-in Payment Instructions</h3>
            <p>Please mail your physical Cheque / Demand Draft to:</p>
            <p>
              <strong>After The Silence Commerce Dept.</strong><br/>
              123 Executive Suite, FC Road<br/>
              Mumbai, Maharashtra - 400001, India
            </p>
            <p><em>Important: Please write your Order ID (<strong>${order.id}</strong>) on a note inside the envelope.</em></p>
          </div>
        `,
      });
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}