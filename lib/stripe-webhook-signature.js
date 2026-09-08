const MAX_AGE_SECONDS = 300;

export async function verifyStripeWebhook(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const parsed = parseHeader(signatureHeader);
  if (!parsed.timestamp || !parsed.signatures.length) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - parsed.timestamp);
  if (age > MAX_AGE_SECONDS) return false;

  const expected = await hmacSha256Hex(secret, `${parsed.timestamp}.${rawBody}`);
  return parsed.signatures.some((signature) => timingSafeEqual(signature, expected));
}

function parseHeader(header) {
  const timestamp = Number(
    header
      .split(",")
      .map((part) => part.trim())
      .find((part) => part.startsWith("t="))
      ?.slice(2)
  );
  const signatures = header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  return {
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    signatures
  };
}

async function hmacSha256Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
