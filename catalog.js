// Single source of truth for Atlas products and UK delivery.
// Amounts are integer pence. The shop UI converts to pounds; Stripe charges these values.

export const DELIVERY_FEE_PENCE = 450;
export const DELIVERY_LINE_NAME = "UK delivery";
export const DELIVERY_LINE_DESCRIPTION = "Flat postage and packaging";

export function isDeliveryLineName(name) {
  return String(name || "").toLowerCase().includes(DELIVERY_LINE_NAME.toLowerCase());
}

export const PRODUCTS = {
  serra: {
    id: "serra",
    name: "Serra Negra",
    pricesPence: {
      "250g": 1095,
      "500g": 1950,
      "1kg": 3595
    }
  },
  peru: {
    id: "peru",
    name: "Peru Cajamarca",
    pricesPence: {
      "250g": 1395,
      "500g": 2695,
      "1kg": 4995
    }
  }
};

export function penceToPounds(pence) {
  return Number(pence) / 100;
}

export function getDeliveryFeePounds() {
  return penceToPounds(DELIVERY_FEE_PENCE);
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
      prices
    };
  });

  return products;
}

export function getStripePriceMap() {
  const priceMap = {};

  Object.values(PRODUCTS).forEach((product) => {
    priceMap[product.name] = { ...product.pricesPence };
  });

  return priceMap;
}

export function fromPriceLabel(productId) {
  const product = PRODUCTS[productId];

  if (!product) return "";

  const lowestPence = Math.min(...Object.values(product.pricesPence));
  return `From £${formatPoundsCompact(penceToPounds(lowestPence))}`;
}

function formatPoundsCompact(pounds) {
  return pounds.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
