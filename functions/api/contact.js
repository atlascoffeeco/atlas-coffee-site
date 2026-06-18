export async function onRequestPost(context) {
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

    const ip =
      context.request.headers.get("CF-Connecting-IP") ||
      context.request.headers.get("x-forwarded-for") ||
      "";

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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}