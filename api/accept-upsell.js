// One-click upsell: charges the saved card for the charging pad.
// POST /api/accept-upsell  { sessionId: "cs_..." }
// The idempotency key and the status saved on the first payment mean it can never charge twice.

import { getStripe, isValidSessionId, loadSession, summarise } from "./_order.js";
import { getQuery, insertEvent } from "./_db.js";
import { UPSELL } from "../src/data/offer.js";

const DECLINED = "Your bank didn't approve the charging pad, so we haven't added it. Your order is confirmed.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const id = req.body?.sessionId;
  if (!isValidSessionId(id)) {
    res.status(400).json({ error: "We couldn't find that order." });
    return;
  }

  try {
    const stripe = getStripe();
    const session = await loadSession(stripe, id);
    const order = summarise(session);
    const intent = session.payment_intent;

    if (order.upsell.added) {
      res.status(200).json({ added: true });
      return;
    }
    if (!order.upsell.canOffer) {
      res.status(409).json({ added: false, error: "This offer is no longer available." });
      return;
    }

    let charge;
    try {
      const shipping = session.collected_information?.shipping_details || session.shipping_details;
      charge = await stripe.paymentIntents.create(
        {
          amount: UPSELL.price * 100,
          currency: "usd",
          customer: session.customer,
          payment_method: intent.payment_method.id,
          off_session: true,
          confirm: true,
          description: `${UPSELL.name} (added after checkout)`,
          receipt_email: order.email || undefined,
          shipping: shipping?.address ? { name: shipping.name, address: shipping.address } : undefined,
          metadata: { orderSession: session.id, product: UPSELL.id },
        },
        { idempotencyKey: `upsell-${session.id}` }
      );
    } catch (err) {
      if (err.code === "idempotency_key_in_use") {
        res.status(409).json({ added: false, error: "Still adding it. Please wait a moment." });
        return;
      }
      console.error("Upsell declined:", err.code || err.message);
      await stripe.paymentIntents.update(intent.id, { metadata: { upsellStatus: "failed" } });
      res.status(402).json({ added: false, error: DECLINED });
      return;
    }

    const ok = charge.status === "succeeded";
    await stripe.paymentIntents.update(intent.id, {
      metadata: { upsellStatus: ok ? "succeeded" : "failed", upsellPaymentIntent: charge.id },
    });
    if (!ok) {
      res.status(402).json({ added: false, error: DECLINED });
      return;
    }

    const query = getQuery();
    if (query) {
      const m = session.metadata || {};
      await insertEvent(query, {
        sessionId: m.sessionId || session.id,
        event: "upsell_accepted",
        variant: m.variant || null,
        utmSource: m.utmSource || null,
        utmCampaign: m.utmCampaign || null,
        valueCents: UPSELL.price * 100,
        dedupeKey: `upsell:${session.id}`,
      }).catch((e) => console.error("Record upsell error:", e.message));
    }

    res.status(200).json({ added: true });
  } catch (err) {
    console.error("Upsell error:", err.message);
    res.status(500).json({ added: false, error: "We couldn't add it. Your order is confirmed." });
  }
}
