// Cloudflare Pages Function
// File path: functions/api/create-checkout-session.js
//
// Purpose:
// - Receive the basket from the frontend
// - Validate items and prices on the server
// - Create a Stripe Checkout Session
// - Return the Stripe-hosted checkout URL

import { DELIVERY_LINE_DESCRIPTION, DELIVERY_LINE_NAME, getDeliveryFeePenceForBasket, getStripePriceMap, isDropoffPostcode, normaliseUkPostcode, orderGrindLabel, resolveOrderGrind, stripeLineName } from "../../catalog.js";
import { allocateOrderReference } from "../../lib/order-reference.js";

export async function onRequest(context) {
  const { request, env } = context;

  // Only allow POST requests
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  // Stripe secret key must exist in Cloudflare env vars
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Missing STRIPE_SECRET_KEY environment variable." }, 500);
  }

  // Use PUBLIC_SITE_URL if it exists, otherwise fall back to the current request origin
  let origin;
  try {
    origin = env.PUBLIC_SITE_URL
      ? new URL(env.PUBLIC_SITE_URL).origin
      : new URL(request.url).origin;
  } catch {
    return json({ error: "Unable to determine site origin." }, 500);
  }

  let body;

  // Parse JSON sent from the frontend
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const { items = [], fulfilment = "delivery" } = body || {};

  // Reject empty baskets
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "Your basket is empty." }, 400);
  }

  // Prevent unexpectedly large basket payloads
  if (items.length > 20) {
    return json({ error: "Basket is too large." }, 400);
  }

  // Only allow supported fulfilment values
  if (!["delivery", "collection", "dropoff"].includes(fulfilment)) {
    return json({ error: "Invalid fulfilment option." }, 400);
  }

  let dropoffPostcode = "";
  let dropoffAddress = "";
  if (fulfilment === "dropoff") {
    dropoffPostcode = normaliseUkPostcode(body.dropoffPostcode);
    dropoffAddress = String(body.dropoffAddress || "").replace(/\s+/g, " ").trim();
    if (!isDropoffPostcode(dropoffPostcode)) {
      return json({ error: "That postcode is outside the local drop-off area." }, 400);
    }
    if (dropoffAddress.length < 8 || dropoffAddress.length > 120) {
      return json({ error: "Add the drop-off address." }, 400);
    }
  }

  // Server-side price map in pence (from catalog.js)
  // Never trust prices from the browser
  const PRICE_MAP = getStripePriceMap();

  try {
    const validatedItems = items.map((item) => {
      const product = typeof item?.product === "string" ? item.product.trim() : "";
      const weight = typeof item?.weight === "string" ? item.weight.trim() : "";
      const grind = resolveOrderGrind(item?.grind);
      const quantity = Math.max(1, Math.min(10, Number(item?.quantity) || 1));

      const unitAmount = PRICE_MAP[product]?.[weight];

      if (!product || !weight || !unitAmount) {
        throw new Error(
          `Invalid product selection: ${product || "unknown"} / ${weight || "unknown"}`
        );
      }

      return { product, weight, grind, quantity, unitAmount };
    });

    const lineItems = validatedItems.map((item) => ({
      price_data: {
        currency: "gbp",
        product_data: {
          name: stripeLineName(item.product, item.weight),
          description: `Grind: ${orderGrindLabel(item.grind)}`
        },
        unit_amount: item.unitAmount
      },
      quantity: item.quantity
    }));

    const deliveryFeePence = getDeliveryFeePenceForBasket(validatedItems, fulfilment);

    if (deliveryFeePence > 0) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: DELIVERY_LINE_NAME,
            description: DELIVERY_LINE_DESCRIPTION
          },
          unit_amount: deliveryFeePence
        },
        quantity: 1
      });
    }

    // Stripe expects form-encoded payloads for direct API calls
    const formData = new URLSearchParams();

    formData.set("mode", "payment");
    formData.set("success_url", `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    formData.set("cancel_url", `${origin}/shop`);

    const orderReference = await allocateOrderReference(env.ORDER_NUMBERS);

    formData.set("client_reference_id", orderReference);
    formData.set("metadata[order_reference]", orderReference);
    formData.set("metadata[fulfilment]", fulfilment);
    formData.set("payment_intent_data[metadata][order_reference]", orderReference);
    formData.set("payment_intent_data[metadata][fulfilment]", fulfilment);
    formData.set("payment_intent_data[description]", `Atlas Coffee ${orderReference}`);

    if (fulfilment === "dropoff") {
      formData.set("metadata[dropoff_postcode]", dropoffPostcode);
      formData.set("metadata[dropoff_address]", dropoffAddress);
      formData.set("payment_intent_data[metadata][dropoff_postcode]", dropoffPostcode);
      formData.set("payment_intent_data[metadata][dropoff_address]", dropoffAddress);
    }

    if (fulfilment === "collection" || fulfilment === "dropoff") {
      formData.set("phone_number_collection[enabled]", "true");
      formData.set("name_collection[individual][enabled]", "true");
      formData.set("billing_address_collection", "auto");
    } else {
      formData.set("billing_address_collection", "required");
      formData.append("shipping_address_collection[allowed_countries][]", "GB");
    }

    // Add each basket item to the Stripe request
    lineItems.forEach((item, index) => {
      formData.set(`line_items[${index}][quantity]`, String(item.quantity));
      formData.set(`line_items[${index}][price_data][currency]`, item.price_data.currency);
      formData.set(`line_items[${index}][price_data][unit_amount]`, String(item.price_data.unit_amount));
      formData.set(`line_items[${index}][price_data][product_data][name]`, item.price_data.product_data.name);

      if (item.price_data.product_data.description) {
        formData.set(
          `line_items[${index}][price_data][product_data][description]`,
          item.price_data.product_data.description
        );
      }
    });

    // Send request to Stripe
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData
    });

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return json(
        { error: session?.error?.message || "Unable to create checkout session." },
        400
      );
    }

    if (!session?.url) {
      return json({ error: "Stripe did not return a checkout URL." }, 500);
    }

    return json({ url: session.url }, 200);
  } catch (error) {
    return json(
      { error: error?.message || "Server error creating checkout session." },
      500
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}