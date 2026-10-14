# Shop fulfillment

## India-only checkout

Checkout always stores `country: "IN"` and the server rejects other shipping destinations. The phone country calling code remains independently selectable; it does not change the shipping destination.

## Product types

Each product is marked either print-on-demand (`is_pod`) or normal. A POD product must have a SKU from the seller's Qikink **My Products** catalog. Create/configure its product and artwork in Qikink first, then copy the exact SKU into the product in **Admin → Shop**. Existing Printful variant IDs do not map to Qikink SKUs.

Before deploying this change, apply `supabase/migrations/20261014_shop_fulfillment.sql` to the Supabase database. Existing products default to POD so existing catalog items keep their previous fulfillment classification; edit each POD item and add its Qikink My Products SKU before taking automatic orders.

Apply `supabase/migrations/20261014143000_shop_controls_promotions_refunds.sql` and `supabase/migrations/20261014150500_checkout_sessions.sql` for shop visibility, promo codes, refunds, and saved checkout snapshots. The checkout snapshot stores the server-priced cart and shipping details against the Razorpay order so payment verification does not rely on browser-submitted order data or reject a payment if inventory changes while checkout is open. The follow-up migration ensures the checkout table exists even if the earlier shop-controls migration was already applied before checkout snapshots were added, and asks Supabase to refresh its API schema cache.

Apply `supabase/migrations/20261014152000_remove_dtdc_tracking.sql` to convert any existing DTDC tracking selections to manual tracking.

Apply `supabase/migrations/20261014164500_preserve_promo_redemption_history.sql` to permit deleting promo codes while retaining their redemption audit records.

Apply `supabase/migrations/20261014180000_qikink_pod_provider.sql` to add Qikink product mappings and provider order references. Keep the existing Printful order fields; historical Printful orders are not converted to Qikink.

## Shop visibility and stock

Administrators can turn public shop browsing off in **Admin → Site Settings → Shop visibility**. When disabled, public shop/product pages return a 404 and public checkout is blocked; products and existing order tracking remain intact. Use **Preview shop as admin** from the settings page to inspect the catalog and exercise checkout while signed in. Preview checkout uses the site's normal Razorpay credentials and live fulfillment: completing it charges the payment method and creates an ordinary order, including Qikink submission for POD products. Treat this as a real purchase, not a test transaction. The preview checkout flag is retained only on the checkout session to enforce admin authorization; the resulting paid order is tracked and managed like any other order. A preview URL opened without an admin session returns a 404. In **Admin → Shop**, edit products or quickly mark each item in/out of stock.

Apply `supabase/migrations/20261014181500_admin_preview_checkout.sql` to store the admin-preview access flag on checkout sessions. New preview purchases are ordinary live orders; the separate order flag remains available to distinguish any older test-only records.

## Promo codes

In **Admin → Shop → Promo codes**, create a percentage or fixed-amount discount, with an optional maximum discount, minimum basket amount, usage cap, and start/expiry dates. Customers apply the code in checkout. The server calculates the discount from current product prices and reserves limited uses while Razorpay checkout is open; a successful verified payment records the redemption. Abandoned checkout reservations expire after one hour.

## Refunds

In **Admin → Orders**, select **Issue refund** on a Razorpay-paid order and enter a full or partial amount. The server checks the captured payment and already processed or pending refunds, reserves the amount atomically, and submits the real refund to Razorpay. Refund results appear in the order history; Razorpay `refund.processed` and `refund.failed` webhooks update the final status. Configure the Razorpay webhook to send those events to the existing `/api/checkout/webhook` URL. If a network timeout leaves the provider result uncertain, the amount stays reserved and must be checked in Razorpay before another refund is attempted. Offline/manual payments cannot be refunded through this automatic workflow. A POD payment refund does not cancel production or shipping; request cancellation from the POD provider separately.

## Qikink POD fulfillment

Configure these server-only environment variables in the deployment environment (and in local `.env.local` for development):

- `QIKINK_ENV`: explicitly set to `sandbox` or `live`. Use `sandbox` with sandbox credentials for testing. Qikink must provision Live API access before live orders can be created.
- `QIKINK_CLIENT_ID`: the Client ID for the selected Qikink environment.
- `QIKINK_CLIENT_SECRET`: the matching private Client Secret. Never add either credential to browser code, source control, or a chat message.
- `CRON_SECRET`: a long random secret configured in the Vercel project so the scheduled status-sync route only accepts Vercel Cron requests.

After Razorpay confirms payment, the server sends only POD items to Qikink, with the buyer's name, email, phone, and India shipping address. It uses Qikink's documented prepaid order flow and `qikink_shipping: 1`, so Qikink arranges provider shipping rather than using the store's Shiprocket pickup flow. The order number is a stable, short reference; before creating an order or retrying an uncertain request, the app searches Qikink by that reference to reduce duplicate submissions. A Qikink API/setup error is recorded on the store order. An admin can retry failed submissions in **Admin → Orders**.

The app stores Qikink's order ID and reference. Vercel Cron is configured to poll up to 20 least-recently-checked active POD orders every 15 minutes using Qikink's documented order-list API; this rotates through larger backlogs over later runs. Use **Refresh Qikink status** on an order in **Admin → Orders** for an immediate refresh. The customer tracking page reflects the latest successful sync. Qikink's supplied API documentation does not describe a webhook contract, so this integration does not invent or configure a Qikink webhook. The deployment must support Vercel Cron schedules at 15-minute intervals.

Products must exist in Qikink **My Products** and have the correct SKU before they can be sold as POD. The product's storefront price is sent as the order-line price, while Qikink applies the account's product and shipping charges. Verify the product SKU and pricing in Qikink Sandbox before enabling live credentials; live order creation can incur provider charges.

Orders that had already been submitted to Printful remain marked as legacy Printful orders; they are not re-sent to Qikink. The existing Printful webhook route remains available only to synchronize those previously submitted orders. New POD purchases use Qikink. Normal products are not sent to Qikink; their paid orders remain editable in Order Management, including status and tracking. Shiprocket tracking can automatically update a normal order after its AWB is entered and Shiprocket sends tracking webhooks; other carriers can still be updated manually.

## Normal-order courier tracking

Normal orders remain editable in Order Management. Choose **Shiprocket** as the tracking provider and enter the shipment AWB. In Shiprocket, enable shipment webhooks and point the callback to:

`https://<your-domain>/api/carrier/events`

Set the webhook authentication type to `x-api-key` and use a fresh random webhook secret stored server-side as `SHIPROCKET_WEBHOOK_TOKEN`. Do not use an API access token as the webhook secret. The callback accepts Shiprocket's `x-api-key` header and the legacy `anx-api-key` header. The webhook's status changes update the matching normal order by AWB; POD items are protected from this carrier webhook. This updates tracking after you create/book the shipment in Shiprocket and record its AWB here; it does not create the carrier shipment or buy a label.

Manual tracking remains available for carriers that are not integrated. Shiprocket tracking is the only automatic carrier integration.

## Payment and fulfillment notes

Qikink order creation is a real fulfillment action and may charge the Qikink account according to its billing settings. Test the full flow with Sandbox credentials and a test product before enabling Live API credentials.

Shiprocket's official [API documentation](https://apidocs.shiprocket.in/) describes its webhook callback payload and authentication configuration.
