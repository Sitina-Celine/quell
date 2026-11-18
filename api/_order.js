// Shared order helpers for the upsell and thank-you pages.
// Reads the paid order from Stripe and records the purchase for the dashboard.

import Stripe from "stripe";
import { UPSELL } from "../src/data/offer.js";
import { getQuery, insertEvent } from "./_db.js";

export const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);

export const isValidSessionId = (id) => typeof id === "string" && /^cs_(test|live)_[A-Za-z0-9]+$/.test(id);

export function loadSession(stripe, id) {
  return stripe.checkout.sessions.retrieve(id, { expand: ["line_items", "payment_intent.payment_method"] });
}

const dollars = (c) => (c || 0) / 100;

export function summarise(session) {
  const intent = session.payment_intent || {};
  const method = intent.payment_method || {};
  const meta = intent.metadata || {};
  const shipping = session.collected_information?.shipping_details || session.shipping_details || null;
  const a = shipping?.address || {};
  const paid = session.payment_status === "paid";
  const upsellAdded = meta.upsellStatus === "succeeded";

  return {
    paid,
    orderNumber: (intent.id || session.id).slice(-8).toUpperCase(),
    email: session.customer_details?.email || "",
    firstName: (shipping?.name || session.customer_details?.name || "").split(" ")[0],
    card: method.card ? { brand: method.card.brand, last4: method.card.last4 } : null,
    items: (session.line_items?.data || []).map((l) => ({ name: l.description, qty: l.quantity, total: dollars(l.amount_total) })),
    subtotal: dollars(session.amount_subtotal),
    discount: dollars(session.total_details?.amount_discount),
    total: dollars(session.amount_total) + (upsellAdded ? UPSELL.price : 0),
    address: shipping
      ? { name: shipping.name, line1: a.line1 || "", line2: a.line2 || "", city: a.city || "", state: a.state || "", postalCode: a.postal_code || "" }
      : null,
    upsell: {
      ...UPSELL,
      canOffer: paid && Boolean(session.customer) && method.type === "card" && !meta.upsellStatus,
      added: upsellAdded,
      failed: meta.upsellStatus === "failed",
    },
  };
}

// Records the purchase once, whichever order page loads first
export async function recordPurchase(session) {
  const query = getQuery();
  if (!query || session.payment_status !== "paid") return;
  const m = session.metadata || {};
  const items = session.line_items?.data || [];
  const protectCents = m.protect === "yes" ? items.find((l) => /Protect/.test(l.description))?.amount_subtotal || 0 : 0;
  try {
    await insertEvent(query, {
      sessionId: m.sessionId || session.id,
      event: "purchase",
      variant: m.variant || null,
      utmSource: m.utmSource || null,
      utmCampaign: m.utmCampaign || null,
      valueCents: session.amount_total || 0,
      meta: {
        bundle: m.bundle,
        bundle_cents: (session.amount_subtotal || 0) - protectCents,
        protect_cents: protectCents,
        discount_cents: session.total_details?.amount_discount || 0,
      },
      dedupeKey: `purchase:${session.id}`,
    });
  } catch (err) {
    console.error("Record purchase error:", err.message);
  }
}
