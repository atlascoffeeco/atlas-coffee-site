// POST /api/stripe-webhook
// Stripe Dashboard → Developers → Webhooks → add endpoint
// URL: https://www.atlascoffee.uk/api/stripe-webhook
// Event: checkout.session.completed (and checkout.session.async_payment_succeeded)
// Then set STRIPE_WEBHOOK_SECRET in Cloudflare Pages.

import { isDeliveryLineName } from "../../catalog.js";
import { buildMerchantOrderEmail, buildOrderConfirmationEmail } from "../../lib/order-confirmation-email.js";
import { verifyStripeWebhook } from "../../lib/stripe-webhook-signature.js";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment.succeeded"
]);

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const missing = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "CONTACT_FROM_EMAIL"
  ].filter((key) => !env[key]);

  if (missing.length) {
    return json({ error: `Missing ${missing.join(", ")}.` }, 500);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const valid = await verifyStripeWebhook(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  if (!valid) {
    return json({ error: "Invalid Stripe signature." }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return json({ received: true }, 200);
  }

  const sessionId = event.data?.object?.id;
  if (!sessionId || !String(sessionId).startsWith("cs_")) {
    return json({ received: true }, 200);
  }

  try {
    const eventSession = event.data?.object || {};
    let session = eventSession;
    let retrieveError = "";

    try {
      session = await retrieveSession(env.STRIPE_SECRET_KEY, sessionId);
    } catch (error) {
      retrieveError = error?.message || "Unable to load checkout session.";
      session = {
        ...eventSession,
        line_items: eventSession.line_items || { data: [] }
      };
    }

    if (session.payment_status && session.payment_status !== "paid") {
      return json({ received: true, skipped: "unpaid" }, 200);
    }

    const to = session.customer_details?.email || session.customer_email;
    if (!to) {
      return json({ received: true, skipped: "no_email", retrieveError }, 200);
    }

    const origin = siteOrigin(env.PUBLIC_SITE_URL);
    const fulfilment = session.metadata?.fulfilment === "collection" ? "collection" : "delivery";
    let items = (session.line_items?.data || []).map(mapLineItem);

    const coffeeItems = items.filter((item) => !isDeliveryLineName(item.name));
    if (!coffeeItems.length) {
      items = [
        {
          name: "Your Atlas Coffee order",
          description: "",
          quantity: 1,
          amountTotal: Number(session.amount_total || 0)
        }
      ];
    }

    const email = buildOrderConfirmationEmail({
      origin,
      customerName: session.customer_details?.name || "",
      fulfilment,
      items,
      totalPence: Number(session.amount_total || 0)
    });

    const customerEmail = session.customer_details?.email || session.customer_email;
    const merchantTo = env.CONTACT_TO_EMAIL || "atlascoffeeroasters@gmail.com";
    const resendBody = {
      from: env.CONTACT_FROM_EMAIL,
      to: [to],
      reply_to: merchantTo,
      subject: email.subject,
      html: email.html,
      text: email.text
    };

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `atlas-order-${sessionId}`
      },
      body: JSON.stringify(resendBody)
    });

    const resendData = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      return json(
        {
          error: resendData.message || "Resend error.",
          retrieveError: retrieveError || undefined
        },
        500
      );
    }

    const shipping = session.shipping_details || session.collected_information?.shipping_details || {};
    const merchant = buildMerchantOrderEmail({
      customerName: session.customer_details?.name || "",
      customerEmail,
      customerPhone: session.customer_details?.phone || "",
      fulfilment,
      items,
      totalPence: Number(session.amount_total || 0),
      shippingName: shipping.name || "",
      shippingAddress: shipping.address || null
    });

    const merchantResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `atlas-merchant-${sessionId}`
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL,
        to: [merchantTo],
        subject: merchant.subject,
        html: merchant.html,
        text: merchant.text
      })
    });

    if (!merchantResponse.ok) {
      const merchantData = await merchantResponse.json().catch(() => ({}));
      return json(
        {
          error: merchantData.message || "Merchant email failed.",
          customerEmailed: true,
          retrieveError: retrieveError || undefined
        },
        500
      );
    }

    return json({
      received: true,
      emailed: true,
      merchant: "sent",
      retrieveError: retrieveError || undefined
    }, 200);
  } catch (error) {
    return json(
      { error: error?.message || "Webhook handler failed." },
      500
    );
  }
}

function siteOrigin(value) {
  try {
    return value ? new URL(value).origin : "https://www.atlascoffee.uk";
  } catch {
    return "https://www.atlascoffee.uk";
  }
}

async function retrieveSession(secretKey, sessionId) {
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Stripe-Version": "2024-04-10"
  };
  const sessionRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers }
  );
  const session = await sessionRes.json();
  if (!sessionRes.ok) {
    throw new Error(session?.error?.message || "Unable to load checkout session.");
  }

  const itemsUrl = new URL(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items`
  );
  itemsUrl.searchParams.set("limit", "100");
  itemsUrl.searchParams.append("expand[]", "data.price.product");

  let itemsRes = await fetch(itemsUrl, { headers });
  let lineItems = await itemsRes.json();
  if (!itemsRes.ok) {
    itemsUrl.searchParams.delete("expand[]");
    itemsRes = await fetch(itemsUrl, { headers });
    lineItems = await itemsRes.json();
  }
  if (!itemsRes.ok) {
    throw new Error(lineItems?.error?.message || "Unable to load order items.");
  }

  session.line_items = lineItems;
  return session;
}

function mapLineItem(line) {
  const product = typeof line.price?.product === "object" ? line.price.product : null;
  const grindSource = [product?.description, line.description].find((value) =>
    /^Grind:\s*/i.test(String(value || ""))
  );

  return {
    name: line.description || product?.name || "Coffee",
    description: grindSource || "",
    quantity: line.quantity || 1,
    amountTotal: Number(line.amount_total || 0)
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
