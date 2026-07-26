var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/contact.js
async function onRequestPost(context) {
  try {
    const contentType = context.request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return Response.json(
        { error: "Invalid content type." },
        { status: 400 }
      );
    }
    const {
      name,
      email,
      subject,
      message,
      website,
      turnstileToken
    } = await context.request.json();
    if (website) {
      return Response.json(
        { error: "Spam detected." },
        { status: 400 }
      );
    }
    if (!name || !email || !subject || !message) {
      return Response.json(
        { error: "Please complete all fields." },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return Response.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (!turnstileToken) {
      return Response.json(
        { error: "Please complete the spam check." },
        { status: 400 }
      );
    }
    const resendKey = context.env.RESEND_API_KEY;
    const contactTo = context.env.CONTACT_TO_EMAIL;
    const contactFrom = context.env.CONTACT_FROM_EMAIL;
    const turnstileSecret = context.env.TURNSTILE_SECRET_KEY;
    const missingEnv = [];
    if (!resendKey) missingEnv.push("RESEND_API_KEY");
    if (!contactTo) missingEnv.push("CONTACT_TO_EMAIL");
    if (!contactFrom) missingEnv.push("CONTACT_FROM_EMAIL");
    if (!turnstileSecret) missingEnv.push("TURNSTILE_SECRET_KEY");
    if (missingEnv.length) {
      return Response.json(
        { error: `Missing required environment variable(s): ${missingEnv.join(", ")}.` },
        { status: 500 }
      );
    }
    const ip = context.request.headers.get("CF-Connecting-IP") || context.request.headers.get("x-forwarded-for") || "";
    let turnstileResponse;
    let turnstileData;
    try {
      turnstileResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: turnstileToken,
            remoteip: ip
          })
        }
      );
    } catch (fetchError) {
      return Response.json(
        { error: "Failed to verify spam protection." },
        { status: 502 }
      );
    }
    try {
      turnstileData = await turnstileResponse.json();
    } catch (jsonError) {
      return Response.json(
        { error: "Invalid response from spam protection service." },
        { status: 502 }
      );
    }
    if (!turnstileResponse.ok || !turnstileData.success) {
      return Response.json(
        {
          error: "Spam check failed. Please try again.",
          details: turnstileData["error-codes"] || []
        },
        { status: 400 }
      );
    }
    let resendResponse, resendData;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: contactFrom,
          to: [contactTo],
          reply_to: email,
          subject: `Atlas Coffee enquiry: ${subject}`,
          html: `
            <h2>New Atlas Coffee contact enquiry</h2>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
            <p><strong>Message:</strong></p>
            <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
          `
        })
      });
    } catch (fetchError) {
      return Response.json(
        { error: "Failed to connect to email provider." },
        { status: 502 }
      );
    }
    try {
      resendData = await resendResponse.json();
    } catch (jsonError) {
      return Response.json(
        { error: "Invalid response from email provider." },
        { status: 502 }
      );
    }
    if (!resendResponse.ok) {
      return Response.json(
        { error: resendData.message || "Email provider error." },
        { status: 500 }
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to process your message." },
      { status: 500 }
    );
  }
}
__name(onRequestPost, "onRequestPost");
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}
__name(isValidEmail, "isValidEmail");
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
__name(escapeHtml, "escapeHtml");

// api/create-checkout-session.js
async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Missing STRIPE_SECRET_KEY environment variable." }, 500);
  }
  const origin = env.PUBLIC_SITE_URL ? new URL(env.PUBLIC_SITE_URL).origin : new URL(request.url).origin;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const { items = [], fulfilment = "delivery" } = body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "Your basket is empty." }, 400);
  }
  const PRICE_MAP = {
    "Serra Negra": {
      "250g": 1095,
      "500g": 1950,
      "1kg": 3595
    },
    "Peru Cajamarca": {
      "250g": 1395,
      // pence = £13.95
      "500g": 2695,
      // pence = £26.95
      "1kg": 4995
      // pence = £49.95
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
            name: `${product} \u2014 ${weight}`,
            description: `Grind: ${GRIND_LABELS[grind] || grind || "Not specified"}`
          },
          unit_amount: unitAmount
        },
        quantity
      };
    });
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
    const formData = new URLSearchParams();
    formData.set("mode", "payment");
    formData.set("success_url", `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    formData.set("cancel_url", `${origin}/cancel.html`);
    formData.set("billing_address_collection", "required");
    formData.set("payment_intent_data[metadata][fulfilment]", fulfilment);
    if (fulfilment === "delivery") {
      formData.append("shipping_address_collection[allowed_countries][]", "GB");
    }
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
__name(onRequest, "onRequest");
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
__name(json, "json");

// api/create-checkout-session-old.js
async function onRequest2(context) {
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
__name(onRequest2, "onRequest");

// api/get-checkout-session.js
async function onRequest3(context) {
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
      price: line.amount_total / 100 / (line.quantity || 1),
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
__name(onRequest3, "onRequest");

// ../.wrangler/tmp/pages-nbQQxE/functionsRoutes-0.007636091869110184.mjs
var routes = [
  {
    routePath: "/api/contact",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/create-checkout-session",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/create-checkout-session-old",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/get-checkout-session",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
