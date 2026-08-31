// Single source of truth for Atlas products and UK delivery.
// Amounts are integer pence. The shop UI converts to pounds; Stripe charges these values.

export const DELIVERY_FEE_PENCE = 450;
export const DELIVERY_LINE_NAME = "UK delivery";
export const DELIVERY_LINE_DESCRIPTION = "Flat postage and packaging";
export const FREE_DELIVERY_THRESHOLD_PENCE = 2500;
export const FREE_DELIVERY_BAG_SIZES = ["500g", "1kg"];

export function isDeliveryLineName(name) {
  return String(name || "").toLowerCase().includes(DELIVERY_LINE_NAME.toLowerCase());
}

export const PRODUCTS = {
  serra: {
    id: "serra",
    name: "Serra Negra",
    displayName: "Serra",
    pricesPence: {
      "250g": 1350,
      "500g": 2400,
      "1kg": 4400
    }
  },
  peru: {
    id: "peru",
    name: "Peru Cajamarca",
    displayName: "Cajamarca",
    pricesPence: {
      "250g": 1650,
      "500g": 3000,
      "1kg": 5500
    }
  }
};

export function penceToPounds(pence) {
  return Number(pence) / 100;
}

export function formatPoundsCompact(pounds) {
  return Number(pounds).toFixed(2).replace(/\.00$/, "");
}

export function getDeliveryFeePounds() {
  return penceToPounds(DELIVERY_FEE_PENCE);
}

export function getFreeDeliveryThresholdPounds() {
  return penceToPounds(FREE_DELIVERY_THRESHOLD_PENCE);
}

export function isFreeDeliveryBagSize(weight) {
  return FREE_DELIVERY_BAG_SIZES.includes(String(weight || ""));
}

export function getStripePriceMap() {
  const priceMap = {};

  Object.values(PRODUCTS).forEach((product) => {
    priceMap[product.name] = { ...product.pricesPence };
  });

  return priceMap;
}

export function basketCoffeeSubtotalPence(items) {
  const priceMap = getStripePriceMap();

  return (items || []).reduce((sum, item) => {
    const product = typeof item?.product === "string" ? item.product.trim() : "";
    const weight = typeof item?.weight === "string" ? item.weight.trim() : "";
    const quantity = Math.max(1, Math.min(10, Number(item?.quantity) || 1));
    const unit = priceMap[product]?.[weight] || 0;
    return sum + unit * quantity;
  }, 0);
}

export function getDeliveryFeePenceForBasket(items, fulfilment) {
  if (fulfilment !== "delivery" || !Array.isArray(items) || items.length === 0) return 0;
  if (items.some((item) => isFreeDeliveryBagSize(item?.weight))) return 0;
  if (basketCoffeeSubtotalPence(items) >= FREE_DELIVERY_THRESHOLD_PENCE) return 0;
  return DELIVERY_FEE_PENCE;
}

export function getDeliveryFeePoundsForBasket(items, fulfilment) {
  return penceToPounds(getDeliveryFeePenceForBasket(items, fulfilment));
}

export function amountToFreeDeliveryPounds(items) {
  const remaining = FREE_DELIVERY_THRESHOLD_PENCE - basketCoffeeSubtotalPence(items);
  return remaining > 0 ? penceToPounds(remaining) : 0;
}

export function getDeliveryPolicyCopy() {
  const fee = formatPoundsCompact(getDeliveryFeePounds());
  const threshold = formatPoundsCompact(getFreeDeliveryThresholdPounds());
  return `£${fee} UK delivery under £${threshold} · Free on 500g, 1kg, and £${threshold}+`;
}

export function bagSizeSavingCopy(prices, weight) {
  const twoFifty = prices["250g"];
  const current = prices[weight];
  if (!twoFifty || !current || weight === "250g") return "";
  const multiples = weight === "1kg" ? 4 : 2;
  const save = twoFifty * multiples - current;
  if (save <= 0.005) return "";
  return `Save £${formatPoundsCompact(save)} vs ${multiples}×250g`;
}

export function weightGrams(weight) {
  if (String(weight) === "1kg") return 1000;
  const grams = Number.parseInt(String(weight), 10);
  return Number.isFinite(grams) ? grams : 0;
}

export function getUiProducts() {
  const products = {};

  Object.values(PRODUCTS).forEach((product) => {
    const prices = {};

    Object.entries(product.pricesPence).forEach(([weight, pence]) => {
      prices[weight] = penceToPounds(pence);
    });

    products[product.id] = {
      id: product.id,
      name: product.name,
      displayName: product.displayName || product.name,
      prices
    };
  });

  return products;
}

export function fromPriceLabel(productId) {
  const product = PRODUCTS[productId];

  if (!product) return "";

  const lowestPence = Math.min(...Object.values(product.pricesPence));
  return `From £${formatPoundsCompact(penceToPounds(lowestPence))}`;
}
