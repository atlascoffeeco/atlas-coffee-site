export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing session_id." }), {
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

    const sessionRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items.data.price.product`,
      {
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`
        }
      }
    );

    const session = await sessionRes.json();

    if (!sessionRes.ok) {
      return new Response(JSON.stringify({ error: session.error?.message || "Stripe error." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const items = (session.line_items?.data || []).map((line) => ({
      item_id: line.price?.id || "",
      item_name: line.description || line.price?.product?.name || "Product",
      item_brand: "Atlas Coffee",
      item_category: "Coffee",
      item_variant: session.metadata?.weight || "",
      price: (line.amount_total / 100) / (line.quantity || 1),
      quantity: line.quantity || 1
    }));

    return new Response(JSON.stringify({
      transaction_id: session.payment_intent || session.id,
      currency: (session.currency || "gbp").toUpperCase(),
      value: (session.amount_total || 0) / 100,
      shipping: (session.total_details?.amount_shipping || 0) / 100,
      tax: (session.total_details?.amount_tax || 0) / 100,
      items
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Server error retrieving checkout session." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}