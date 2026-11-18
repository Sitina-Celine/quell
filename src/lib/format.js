const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// $134 for whole dollars, $120.60 otherwise
export const money = (n) => (Number.isInteger(n) ? usd0.format(n) : usd2.format(n));
export const money2 = (n) => usd2.format(n);
export const percent = (n, digits = 1) => `${(n * 100).toFixed(digits)}%`;
export const number = (n) => new Intl.NumberFormat("en-US").format(n);
