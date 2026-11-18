// Creates the Stripe Checkout Session for the chosen bundle.
// POST /api/create-checkout  { bundle, protect, code, email, sessionId, variant, utmSource, utmCampaign }
// Prices come from src/data/offer.js on the server, never from the browser.

import Stripe from "stripe";
import { BUNDLES, PROTECT, DISCOUNT, PRODUCT_NAME } from "../src/data/offer.js";

const short = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

export function buildCheckout(body) {
  const bundle = BUNDLES[body?.bundle];
  if (!bundle) return { error: "Choose a bundle first." };
  const protect = body?.protect === true;
  const useDiscount = typeof body?.code === "string" && body.code.trim().toUpperCase() === DISCOUNT.code;

  const lineItems = [
    {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: bundle.price * 100,
        product_data: {
          name: `${PRODUCT_NAME}, ${bundle.label}`,
          description: bundle.pairs > 1 ? `${bundle.pairs} pairs with charging cases` : "Earbuds and charging case",
        },
      },
    },
  ];
  if (protect) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: PROTECT.price * 100,
        product_data: { name: PROTECT.name, description: "2-year accidental loss and damage cover" },
      },
    });
  }

  return {
    bundle,
    protect,
    useDiscount,
    lineItems,
    metadata: {
      bundle: bundle.id,
      protect: protect ? "yes" : "no",
      sessionId: short(body?.sessionId, 64),
      variant: ["A", "B"].includes(body?.variant) ? body.variant : "",
      utmSource: short(body?.utmSource, 40),
      utmCampaign: short(body?.utmCampaign, 60),
    },
  };
}

// The 10% coupon is created in Stripe the first time it's needed
async function ensureCoupon(stripe) {
  try {
    await stripe.coupons.retrieve(DISCOUNT.code);
  } catch (err) {
    if (err.code !== "resource_missing") throw err;
    try {
      await stripe.coupons.create({ id: DISCOUNT.code, percent_off: DISCOUNT.percent, duration: "once", name: "10% off first order" });
    } catch (createErr) {
      if (createErr.code !== "resource_already_exists") throw createErr;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const order = buildCheckout(req.body);
  if (order.error) {
    res.status(400).json({ error: order.error });
    return;
  }

  const protocol = req.headers["x-forwarded-proto"] || "http";
  const origin = `${protocol}://${req.headers.host}`;
  const email = typeof req.body?.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email) ? req.body.email : undefined;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    if (order.useDiscount) await ensureCoupon(stripe);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      adaptive_pricing: { enabled: false },
      allowed_payment_method_types: ["card"],
      line_items: order.lineItems,
      discounts: order.useDiscount ? [{ coupon: DISCOUNT.code }] : undefined,
      customer_email: email,
      customer_creation: "always",
      payment_intent_data: { setup_future_usage: "off_session" },
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: "Free standard shipping",
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "usd" },
            delivery_estimate: { minimum: { unit: "business_day", value: 3 }, maximum: { unit: "business_day", value: 5 } },
          },
        },
      ],
      metadata: order.metadata,
      success_url: `${origin}/upsell.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled#buy`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message);
    res.status(500).json({ error: "Checkout couldn't start. Please try again." });
  }
}
