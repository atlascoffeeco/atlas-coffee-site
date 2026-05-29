export async function onRequestPost(context) {
  try {
    const contentType = context.request.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return Response.json(
        { error: "Invalid content type." },
        { status: 400 }
      );
    }

    const { name, email, subject, message } = await context.request.json();

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

    const resendKey = context.env.RESEND_API_KEY;
    const contactTo = context.env.CONTACT_TO_EMAIL;
    const contactFrom = context.env.CONTACT_FROM_EMAIL;

    const missingEnv = [];
    if (!resendKey) missingEnv.push("RESEND_API_KEY");
    if (!contactTo) missingEnv.push("CONTACT_TO_EMAIL");
    if (!contactFrom) missingEnv.push("CONTACT_FROM_EMAIL");

    if (missingEnv.length) {
      return Response.json(
        { error: `Missing required environment variable(s): ${missingEnv.join(", ")}.` },
        { status: 500 }
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