// Cloudflare Pages Function
// File path: functions/api/create-checkout-session.js
//
// Purpose:
// - Receive the basket from the frontend
// - Validate items and prices on the server
// - Create a Stripe Checkout Session
// - Return the Stripe-hosted checkout URL

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

  // Use PUBLIC_SITE_URL if it exists.
  // Otherwise, fall back to the current request origin.
  // This is especially helpful for changing Cloudflare preview/staging URLs.
  const origin = env.PUBLIC_SITE_URL
    ? new URL(env.PUBLIC_SITE_URL).origin
    : new URL(request.url).origin;

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

  // Server-side price map in pence
  // Never trust prices from the browser
  const PRICE_MAP = {
    "Serra Negra": {
      "250g": 1095,
      "500g": 1950,
      "1kg": 3595
    },
    "Peru Cajamarca": {
      "250g": 1395, // pence = £13.95
      "500g": 2695, // pence = £26.95
      "1kg": 4995   // pence = £49.95
    }
  };

  const GRIND_LABELS = {
    whole_bean: "Whole bean",
    coarse: "Coarse",
    medium: "Medium",
    fine: "Fine"
  };

  const DELIVERY_FEE = 450;

  try {
    // Build Stripe line items from the validated basket items
    const lineItems = items.map((item) => {
      const product = typeof item?.product === "string" ? item.product.trim() : "";
      const weight = typeof item?.weight === "string" ? item.weight.trim() : "";
      const grind = typeof item?.grind === "string" ? item.grind.trim() : "";
      const quantity = Math.max(1, Math.min(10, Number(item?.quantity) || 1));

      const unitAmount = PRICE_MAP[product]?.[weight];

      if (!product || !weight || !unitAmount) {
        throw new Error(`Invalid product selection: ${product || "unknown"} / ${weight || "unknown"}`);
      }

      return {
        price_data: {
          currency: "gbp",
          product_data: {
            name: `${product} — ${weight}`,
            description: `Grind: ${GRIND_LABELS[grind] || grind || "Not specified"}`
          },
          unit_amount: unitAmount
        },
        quantity
      };
    });

    // Add delivery as a separate Stripe line item
    if (fulfilment === "delivery") {
      lineItems.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: "UK delivery",
            description: "Flat postage and packaging"
          },
          unit_amount: DELIVERY_FEE
        },
        quantity: 1
      });
    }

    // Stripe expects form-encoded payloads for this direct API call
    const formData = new URLSearchParams();

    formData.set("mode", "payment");
    formData.set("success_url", `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    formData.set("cancel_url", `${origin}/cancel.html`);
    formData.set("billing_address_collection", "required");

    // Store fulfilment choice on the payment intent metadata
    formData.set("payment_intent_data[metadata][fulfilment]", fulfilment);

    // Only collect shipping addresses for delivery orders
    if (fulfilment === "delivery") {
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