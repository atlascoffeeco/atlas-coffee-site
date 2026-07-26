export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const { product, weight, grind, fulfilment, quantity } = body;

    const PRODUCT_PRICE_IDS = {
      "Serra Negra": {
        "250g": env.STRIPE_PRICE_SERRA_NEGRA_250G,
        "500g": env.STRIPE_PRICE_SERRA_NEGRA_500G,
        "1kg": env.STRIPE_PRICE_SERRA_NEGRA_1KG
      },
      "Peru Cajamarca": {
        "250g": env.STRIPE_PRICE_PERU_CAJAMARCA_250G,
        "500g": env.STRIPE_PRICE_PERU_CAJAMARCA_500G,
        "1kg": env.STRIPE_PRICE_PERU_CAJAMARCA_1KG
      }
    };

    const selectedProduct = PRODUCT_PRICE_IDS[product];
    const selectedPrice = selectedProduct?.[weight];
    const qty = Number(quantity);

    if (!selectedProduct) {
      return new Response(JSON.stringify({ error: "Invalid product selected." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!selectedPrice) {
      return new Response(JSON.stringify({ error: "Invalid weight selected." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      return new Response(JSON.stringify({ error: "Quantity must be between 1 and 10." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Missing STRIPE_SECRET_KEY environment variable." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const requiredPriceIds = [
      env.STRIPE_PRICE_SERRA_NEGRA_250G,
      env.STRIPE_PRICE_SERRA_NEGRA_500G,
      env.STRIPE_PRICE_SERRA_NEGRA_1KG,
      env.STRIPE_PRICE_PERU_CAJAMARCA_250G,
      env.STRIPE_PRICE_PERU_CAJAMARCA_500G,
      env.STRIPE_PRICE_PERU_CAJAMARCA_1KG
    ];

    if (requiredPriceIds.some((value) => !value)) {
      return new Response(JSON.stringify({ error: "Missing one or more Stripe Price ID environment variables." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();

    params.append("mode", "payment");
    params.append("success_url", `${origin}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${origin}/shop.html`);

    params.append("line_items[0][price]", selectedPrice);
    params.append("line_items[0][quantity]", String(qty));

    params.append("metadata[product]", product || "");
    params.append("metadata[weight]", weight || "");
    params.append("metadata[grind]", grind || "");
    params.append("metadata[fulfilment]", fulfilment || "");
    params.append("metadata[quantity]", String(qty));
    params.append("metadata[stripe_price_id]", selectedPrice);

    params.append("payment_intent_data[metadata][product]", product || "");
    params.append("payment_intent_data[metadata][weight]", weight || "");
    params.append("payment_intent_data[metadata][grind]", grind || "");
    params.append("payment_intent_data[metadata][fulfilment]", fulfilment || "");
    params.append("payment_intent_data[metadata][quantity]", String(qty));
    params.append("payment_intent_data[metadata][stripe_price_id]", selectedPrice);

    if (fulfilment === "delivery") {
      params.append("shipping_address_collection[allowed_countries][0]", "GB");
      params.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
      params.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "450");
      params.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "gbp");
      params.append("shipping_options[0][shipping_rate_data][display_name]", "UK delivery");
      params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
      params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "2");
      params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
      params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "4");
    }

    if (fulfilment === "collection") {
      params.append("custom_fields[0][key]", "collection_note");
      params.append("custom_fields[0][label][type]", "custom");
      params.append("custom_fields[0][label][custom]", "Collection note");
      params.append("custom_fields[0][type]", "text");
      params.append("custom_fields[0][optional]", "true");
      params.append("custom_fields[0][text][maximum_length]", "120");
    }

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const raw = await stripeResponse.text();
    let session = {};

    try {
      session = raw ? JSON.parse(raw) : {};
    } catch (e) {
      return new Response(JSON.stringify({ error: "Stripe returned invalid JSON.", raw }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!stripeResponse.ok) {
      return new Response(JSON.stringify({ error: session.error?.message || "Stripe error." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Server error creating checkout session." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}