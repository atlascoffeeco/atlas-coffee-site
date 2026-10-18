export const ORDER_NUMBER_START = 1001;

const ORDER_REFERENCE_PATTERN = /^ATLAS-[1-9]\d{3,}$/;

export function formatOrderReference(number) {
  const value = Number(number);
  if (!Number.isInteger(value) || value < ORDER_NUMBER_START) {
    throw new Error("Invalid order number.");
  }
  return `ATLAS-${value}`;
}

export function readOrderReference(metadata) {
  const raw = typeof metadata?.order_reference === "string" ? metadata.order_reference.trim() : "";
  return ORDER_REFERENCE_PATTERN.test(raw) ? raw : "";
}

export async function allocateOrderReference(db) {
  if (!db) {
    throw new Error("Order numbers are not configured.");
  }

  const row = await db
    .prepare(
      "UPDATE order_counter SET next_number = next_number + 1 WHERE id = 1 RETURNING next_number"
    )
    .first();

  if (!row || !Number.isInteger(Number(row.next_number))) {
    throw new Error("Could not allocate an order number.");
  }

  return formatOrderReference(row.next_number);
}
