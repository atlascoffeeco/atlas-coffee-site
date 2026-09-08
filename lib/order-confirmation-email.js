import { PRODUCTS, isDeliveryLineName } from "../catalog.js";

const CREAM = "#efefec";
const SURFACE = "#f7f7f3";
const INK = "#16110d";
const MUTED = "#5f5950";
const GOLD = "#ffa503";

export function shopLabelForStripeName(name) {
  const raw = String(name || "");
  const product = Object.values(PRODUCTS).find((item) =>
    [item.displayName, item.name, ...(item.legacyNames || [])].some((key) => key && raw.startsWith(key))
  );
  if (!product) return raw;
  const from = [product.displayName, product.name, ...(product.legacyNames || [])].find((key) => key && raw.startsWith(key));
  return from ? raw.replace(from, product.displayName) : raw;
}

export function firstNameFrom(fullName) {
  const first = String(fullName || "").trim().split(/\s+/)[0];
  return first || "";
}

export function formatGbp(amountPence) {
  const pounds = Number(amountPence || 0) / 100;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pounds);
}

export function buildOrderConfirmationEmail({
  origin,
  customerName,
  fulfilment,
  items,
  totalPence
}) {
  const firstName = firstNameFrom(customerName);
  const hello = firstName ? `Hi ${escapeHtml(firstName)},` : "Hello,";
  const isCollection = fulfilment === "collection";
  const logoUrl = `${origin}/assets/logo-mark.png`;
  const shopUrl = `${origin}/shop`;

  const nextStep = isCollection
    ? "I'll roast this for you, then email to arrange collection in Redditch."
    : "I'll roast this for you and post it within 2–4 working days.";

  const coffeeRows = items
    .filter((item) => !isDeliveryLineName(item.name))
    .map((item) => {
      const title = escapeHtml(shopLabelForStripeName(item.name));
      const grind = item.description ? escapeHtml(item.description.replace(/^Grind:\s*/i, "")) : "";
      const qty = Number(item.quantity) || 1;
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e4e2dc;font-family:Arial,Helvetica,sans-serif;color:${INK};font-size:15px;line-height:1.4;">
            <strong style="display:block;font-size:16px;">${title}</strong>
            ${grind ? `<span style="color:${MUTED};font-size:13px;">${grind}${qty > 1 ? ` · Qty ${qty}` : ""}</span>` : qty > 1 ? `<span style="color:${MUTED};font-size:13px;">Qty ${qty}</span>` : ""}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e4e2dc;font-family:Arial,Helvetica,sans-serif;color:${INK};font-size:15px;text-align:right;white-space:nowrap;vertical-align:top;">
            ${escapeHtml(formatGbp(item.amountTotal))}
          </td>
        </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Atlas Coffee order</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;">
          <tr>
            <td style="padding:0 0 24px;">
              <img src="${escapeHtml(logoUrl)}" width="72" height="72" alt="Atlas Coffee" style="display:block;border:0;width:72px;height:72px;">
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};font-weight:700;padding:0 0 8px;">
              Order confirmed
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:1.15;letter-spacing:-0.03em;color:${INK};font-weight:700;padding:0 0 20px;">
              We've got your order.
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${INK};padding:0 0 12px;">
              ${hello}
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${INK};padding:0 0 28px;">
              Thank you. ${escapeHtml(nextStep)}
            </td>
          </tr>
          <tr>
            <td style="background:${SURFACE};border:1px solid #e4e2dc;border-radius:16px;padding:20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${coffeeRows}
                <tr>
                  <td style="padding:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};">
                    ${isCollection ? "Collection in Redditch — no delivery charge." : "Includes UK delivery if it applied to this order."}
                  </td>
                  <td style="padding:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${INK};font-weight:700;text-align:right;white-space:nowrap;">
                    ${escapeHtml(formatGbp(totalPence))}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 8px;border-left:3px solid ${GOLD};padding-left:16px;">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD};font-weight:700;">
                Before you brew
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${INK};">
                Wait a few days after roast before brewing — the flavour settles. Filter can be sooner; espresso a little longer.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 0 8px;">
              <a href="${escapeHtml(shopUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${INK};font-weight:700;text-decoration:none;border-bottom:2px solid ${GOLD};padding-bottom:2px;">
                atlascoffee.uk/shop
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${MUTED};">
              Atlas Coffee Company · Redditch<br>
              Questions? Reply to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    firstName ? `Hi ${firstName},` : "Hello,",
    "",
    "We've got your order. Thank you.",
    nextStep,
    "",
    items
      .filter((item) => !isDeliveryLineName(item.name))
      .map((item) => {
        const title = shopLabelForStripeName(item.name);
        const grind = item.description ? item.description.replace(/^Grind:\s*/i, "") : "";
        return `• ${title}${grind ? ` · ${grind}` : ""} × ${item.quantity} — ${formatGbp(item.amountTotal)}`;
      })
      .join("\n"),
    "",
    `Total ${formatGbp(totalPence)}`,
    "",
    "Before you brew: wait a few days after roast before brewing — the flavour settles. Filter can be sooner; espresso a little longer.",
    "",
    "Atlas Coffee Company",
    shopUrl
  ].join("\n");

  return {
    subject: "We've got your Atlas Coffee order",
    html,
    text
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
