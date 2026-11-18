// The offer, in one place. The browser uses it to show prices;
// the server uses it to charge, so editing the page can't change a price.

export const PRODUCT_NAME = "Quell Earbuds";

export const BUNDLES = {
  "1": { id: "1", pairs: 1, label: "1 pair", note: "Earbuds and charging case", price: 79, compareAt: 79 },
  "2": { id: "2", pairs: 2, label: "2 pairs", note: "Save 15%. $67 per pair", price: 134, compareAt: 158, tag: "Most popular" },
  "3": { id: "3", pairs: 3, label: "3 pairs", note: "Save 24%. $60 per pair", price: 179, compareAt: 237, tag: "Best value" },
};
export const DEFAULT_BUNDLE = "2";

// Order bump, offered in the buy box before checkout
export const PROTECT = {
  id: "protect",
  name: "Quell Protect",
  note: "Lost an earbud or cracked the case? We replace it, once, within two years.",
  price: 9,
};

// One-click upsell, offered after payment
export const UPSELL = {
  id: "charging-pad",
  name: "Quell Wireless Charging Pad",
  note: "Drop the case on it at night. Pick it up full in the morning.",
  price: 19,
  compareAt: 29,
};

// Email capture discount
export const DISCOUNT = { code: "QUELL10", percent: 10 };

// The A/B test on the hero headline
export const HEADLINES = {
  A: "Turn the world down.",
  B: "The last earbuds you'll charge this week.",
};
