export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "GET") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return json({ error: "Missing session_id." }, 400);
    }

    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: "Missing STRIPE_SECRET_KEY environment variable." }, 500);
    }

    // Expand the PaymentIntent so fulfilment metadata and payment status are available
    const sessionRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price.product&expand[]=payment_intent`,
      {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
        }
      }
    );

    const session = await sessionRes.json();

    if (!sessionRes.ok) {
      return json({ error: session?.error?.message || "Stripe error." }, 400);
    }

    const paymentIntent = session.payment_intent && typeof session.payment_intent === "object"
      ? session.payment_intent
      : null;

    const fulfilment =
      paymentIntent?.metadata?.fulfilment === "collection"
        ? "collection"
        : "delivery";

    const items = (session.line_items?.data || []).map((line) => {
      const quantity = line.quantity || 1;
      const amountTotal = Number(line.amount_total || 0);
      const amountEach = quantity > 0 ? amountTotal / quantity / 100 : 0;

      return {
        item_id: line.price?.id || "",
        item_name: line.description || line.price?.product?.name || "Product",
        item_brand: "Atlas Coffee",
        item_category: "Coffee",
        item_variant: line.price?.product?.description || "",
        price: amountEach,
        quantity
      };
    });

    return json({
      transactionId: paymentIntent?.id || session.payment_intent || session.id,
      paymentStatus: session.payment_status || "paid",
      fulfilment,
      currency: (session.currency || "gbp").toUpperCase(),
      value: (session.amount_total || 0) / 100,
      shipping: (session.total_details?.amount_shipping || 0) / 100,
      tax: (session.total_details?.amount_tax || 0) / 100,
      items
    });
  } catch (error) {
    return json(
      { error: error?.message || "Server error retrieving checkout session." },
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